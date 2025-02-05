import os
import json
import threading
from flask import Flask, render_template, jsonify, request, redirect, url_for, current_app, Response
from flask_httpauth import HTTPBasicAuth
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash
from flask_socketio import SocketIO
from flask_admin import Admin, BaseView, expose, AdminIndexView
from flask_admin.contrib.sqla import ModelView
from flask_sqlalchemy import SQLAlchemy
from thumbnail_generator import generate_thumbnails_async  # 请确保该模块存在

# 创建 Flask 应用实例
app = Flask(__name__)
app.config['SECRET_KEY'] = 'your-secret-key'
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///mydatabase.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# 初始化扩展
db = SQLAlchemy(app)
auth = HTTPBasicAuth()
socketio = SocketIO(app, socketio_path='/ws')
CORS(app, origins="http://172.16.34.188:5000")

# 读取配置文件，获取认证信息（确保 static/config.json 存在）
CONFIG_FILE = os.path.join(os.path.dirname(__file__), "static/config.json")
with open(CONFIG_FILE, "r", encoding="utf-8") as f:
    config = json.load(f)
users = {
    config["auth"]["username"]: generate_password_hash(config["auth"]["password"])
}

@auth.verify_password
def verify_password(username, password):
    if username in users and check_password_hash(users.get(username), password):
        return username

# 首页和图片浏览页面（均需认证）
@app.route('/')
@auth.login_required
def index():
    return render_template('home_page.html')

@app.route('/photoview')
@auth.login_required
def photoview():
    return render_template('photoview.html')

# 示例 API 接口
@app.route('/api/data', methods=['GET'])
@auth.login_required
def get_data():
    return jsonify({"message": "Hello from Flask in LAN!"})

@app.route('/api/folders', methods=['GET'])
@auth.login_required
def get_folders():
    base_dir = os.path.join(app.static_folder, 'images')
    folder_data = {}
    if os.path.exists(base_dir):
        for folder in os.listdir(base_dir):
            folder_path = os.path.join(base_dir, folder)
            if os.path.isdir(folder_path):
                files = [f for f in os.listdir(folder_path)
                         if f.lower().endswith(('.jpg', '.jpeg', '.png', '.gif'))]
                folder_data[folder] = files
    return jsonify(folder_data)

@app.route('/api/events', methods=['GET'])
@auth.login_required
def get_events():
    events_path = os.path.join(app.static_folder, 'events.json')
    if os.path.exists(events_path):
        with open(events_path, 'r', encoding='utf-8') as f:
            events = json.load(f)
        return jsonify(events)
    else:
        return jsonify({}), 404

@app.route('/api/static-files', methods=['GET'])
@auth.login_required
def get_static_files():
    static_dir = app.static_folder
    file_list = []
    for root, dirs, files in os.walk(static_dir):
        rel_dir = os.path.relpath(root, static_dir)
        for file in files:
            if file.lower().endswith('.json'):
                rel_path = os.path.join(rel_dir, file) if rel_dir != '.' else file
                file_list.append(rel_path)
    return jsonify({"files": file_list})

# 后台线程：监控 events.json 文件变化并推送更新到客户端
def monitor_events():
    events_path = os.path.join(app.static_folder, 'events.json')
    last_mtime = None
    while True:
        try:
            mtime = os.path.getmtime(events_path)
        except Exception:
            mtime = None
        if mtime is not None and mtime != last_mtime:
            last_mtime = mtime
            try:
                with open(events_path, 'r', encoding='utf-8') as f:
                    events = json.load(f)
                socketio.emit('events_updated', events)
                app.logger.info("推送 events 更新")
            except Exception as e:
                app.logger.error("读取 events.json 失败: %s", e)
        socketio.sleep(1)

if __name__ == '__main__':
    # 在 Flask 应用启动时创建数据库表
    with app.app_context():
        db.create_all()

    input_dir = os.path.join(app.static_folder, 'images')
    output_dir = os.path.join(app.static_folder, 'thumbnails')
    threading.Thread(
        target=generate_thumbnails_async,
        args=(input_dir, output_dir, (300, 300), 4)
    ).start()

    # 启动后台任务
    socketio.start_background_task(target=monitor_events)

    # 启动 Flask 应用，启用 HTTPS
    ssl_context = (r'E:\OneDrive\Gits\Sandshark\flask_app\certs\cert.pem', r'E:\OneDrive\Gits\Sandshark\flask_app\certs\key.pem')
    socketio.run(app, host='0.0.0.0', port=5000, ssl_context=ssl_context)
