import os
import json
from flask import Flask, render_template, jsonify
from flask_httpauth import HTTPBasicAuth
from werkzeug.security import generate_password_hash, check_password_hash
import threading
from thumbnail_generator import generate_thumbnails_async

app = Flask(__name__)
auth = HTTPBasicAuth()

# 从外部配置文件加载认证信息
CONFIG_FILE = os.path.join(os.path.dirname(__file__), "./static/config.json")
with open(CONFIG_FILE, "r", encoding="utf-8") as f:
    config = json.load(f)

# 设置用户和密码（密码加密存储）
users = {
    config["auth"]["username"]: generate_password_hash(config["auth"]["password"])
}

@auth.verify_password
def verify_password(username, password):
    if username in users and check_password_hash(users.get(username), password):
        return username

@app.route('/')
@auth.login_required
def index():
    return render_template('home_page.html')

@app.route('/photoview')
@auth.login_required
def photoview():
    return render_template('photoview.html')

@app.route('/api/data', methods=['GET'])
@auth.login_required
def get_data():
    return {"message": "Hello from Flask in LAN!"}

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

# 提供 events.json 接口
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

# 新增接口：递归扫描 static 文件夹下所有文件
@app.route('/api/static-files', methods=['GET'])
@auth.login_required
def get_static_files():
    static_dir = app.static_folder
    file_list = []
    for root, dirs, files in os.walk(static_dir):
        rel_dir = os.path.relpath(root, static_dir)
        for file in files:
            rel_path = os.path.join(rel_dir, file) if rel_dir != '.' else file
            file_list.append(rel_path)
    return jsonify({"files": file_list})

if __name__ == '__main__':
    # 启动缩略图生成线程
    input_dir = os.path.join(app.static_folder, 'images')
    output_dir = os.path.join(app.static_folder, 'thumbnails')
    threading.Thread(
        target=generate_thumbnails_async,
        args=(input_dir, output_dir, (300, 300), 4)
    ).start()
    # 监听 0.0.0.0 使局域网设备可访问，端口 5000
    app.run(host='0.0.0.0', port=5000)
