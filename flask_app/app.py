import os
import json
import threading
from flask import Flask, render_template, jsonify, request, redirect, url_for, current_app
from flask_httpauth import HTTPBasicAuth
from werkzeug.security import generate_password_hash, check_password_hash
from flask_socketio import SocketIO
from flask_admin import Admin, BaseView, expose
from flask_admin.contrib.sqla import ModelView
from flask_sqlalchemy import SQLAlchemy
from thumbnail_generator import generate_thumbnails_async  # 请确保该模块存在

# 创建 Flask 应用实例
app = Flask(__name__)
app.config['SECRET_KEY'] = 'your-secret-key'
# 配置 SQLAlchemy 数据库（这里以 sqlite 为例）
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///mydatabase.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# 初始化扩展
db = SQLAlchemy(app)
auth = HTTPBasicAuth()
socketio = SocketIO(app, socketio_path='/ws')

# 读取配置文件，获取认证信息（假设 static/config.json 存在）
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

# 自定义视图：支持编辑 static 目录下的多个 JSON 文件
class MultiJSONAdminView(BaseView):
    @expose('/', methods=['GET', 'POST'])
    def index(self):
        static_dir = current_app.static_folder
        # 遍历 static 目录（包括子目录），获取所有 JSON 文件的相对路径
        json_files = []
        for root, dirs, files in os.walk(static_dir):
            rel_dir = os.path.relpath(root, static_dir)
            for file in files:
                if file.lower().endswith('.json'):
                    rel_path = os.path.join(rel_dir, file) if rel_dir != '.' else file
                    json_files.append(rel_path)
        # 从请求参数中获取要编辑的文件名，如未选择则默认第一个
        filename = request.args.get('filename', json_files[0] if json_files else None)
        error = None
        file_content = ""
        if filename:
            json_path = os.path.join(static_dir, filename)
            if os.path.exists(json_path):
                try:
                    with open(json_path, 'r', encoding='utf-8') as f:
                        data = json.load(f)
                    file_content = json.dumps(data, ensure_ascii=False, indent=4)
                except Exception as e:
                    error = f"读取 {filename} 失败: " + str(e)
            else:
                error = f"文件 {filename} 不存在。"
        # 处理 POST 提交
        if request.method == 'POST' and filename:
            json_text = request.form.get('json_text')
            try:
                # 验证 JSON 格式
                data = json.loads(json_text)
                json_path = os.path.join(static_dir, filename)
                with open(json_path, 'w', encoding='utf-8') as f:
                    json.dump(data, f, ensure_ascii=False, indent=4)
                return redirect(url_for('.index', filename=filename))
            except Exception as e:
                error = "提交数据格式有误: " + str(e)
                file_content = json_text
        return self.render('admin/multi_json_edit.html',
                           json_text=file_content,
                           error=error,
                           json_files=json_files,
                           current_file=filename)

# 如果需要管理数据库中的模型，可参考下面示例定义模型并添加管理视图
class Event(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    date = db.Column(db.String(20))
    description = db.Column(db.String(200))
    def __repr__(self):
        return f'<Event {self.date} - {self.description}>'

# 初始化 Flask-Admin
admin = Admin(app, name='后台管理', template_mode='bootstrap3')
# 添加数据库模型管理（如 Event 模型）
admin.add_view(ModelView(Event, db.session))
# 添加支持多个 JSON 文件编辑的管理视图
admin.add_view(MultiJSONAdminView(name='JSON 管理', endpoint='json_admin'))

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
    # 数据库初始化（若不存在则创建表）
    with app.app_context():
        db.create_all()
    # 启动生成缩略图的线程（根据实际情况调整参数）
    input_dir = os.path.join(app.static_folder, 'images')
    output_dir = os.path.join(app.static_folder, 'thumbnails')
    threading.Thread(
        target=generate_thumbnails_async,
        args=(input_dir, output_dir, (300, 300), 4)
    ).start()
    # 启动监控 events.json 的后台任务
    socketio.start_background_task(target=monitor_events)
    # 启动 Flask 应用（支持 SocketIO）
    socketio.run(app, host='0.0.0.0', port=5000)
