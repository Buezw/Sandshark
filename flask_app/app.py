import os
import json
import threading
from flask import Flask, render_template, jsonify, request, redirect, url_for, current_app, Response
from flask_httpauth import HTTPBasicAuth
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

# 全局文件操作锁，保证多线程读写时安全
file_lock = threading.Lock()

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

# --- 通用 JSON 辅助函数 ---
def read_json(file_path):
    try:
        with file_lock:
            with open(file_path, 'r', encoding='utf-8') as f:
                return json.load(f)
    except Exception as e:
        app.logger.error("读取 %s 失败: %s", file_path, e)
        return None

def write_json(file_path, data):
    with file_lock:
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=4)

@app.route('/api/events', methods=['GET'])
@auth.login_required
def api_events():
    file_path = os.path.join(current_app.static_folder, 'events.json')
    data = read_json(file_path)
    if data is None:
        return jsonify({}), 404
    return jsonify(data)

@app.route('/api/todos', methods=['GET', 'POST'])
@auth.login_required
def api_todos():
    file_path = os.path.join(current_app.static_folder, 'todo.json')
    if request.method == 'GET':
        todos = read_json(file_path)
        if not isinstance(todos, list):
            todos = []
        # 自动删除标记为完成的 todo（completed 为真）
        filtered = [todo for todo in todos if not todo.get("completed")]
        if len(filtered) != len(todos):
            write_json(file_path, filtered)
            todos = filtered
        return jsonify(todos)
    else:  # POST 请求
        new_data = request.get_json()
        if new_data is None:
            return jsonify({"error": "缺少提交数据"}), 400
        todos = read_json(file_path)
        if not isinstance(todos, list):
            todos = []
        # 当提交数据中 completed 为真时，认为该 todo 已完成，进行删除操作（以 text 字段匹配）
        if new_data.get("completed"):
            text_to_complete = new_data.get("text")
            new_todos = [todo for todo in todos if todo.get("text") != text_to_complete]
            write_json(file_path, new_todos)
            socketio.emit('todo_updated', new_todos)
            return jsonify({"message": "已删除完成的 todo"}), 200
        else:
            # 添加新 todo 时默认设置 completed 为 false
            new_data.setdefault("completed", False)
            todos.append(new_data)
            write_json(file_path, todos)
            socketio.emit('todo_updated', todos)
            return jsonify(new_data), 201


# 后台监控函数：监控 static 下所有 .json 文件的变化
def monitor_events():
    static_dir = app.static_folder
    file_mtimes = {}
    # 初始化所有 .json 文件的修改时间
    for root, dirs, files in os.walk(static_dir):
        for file in files:
            if file.lower().endswith('.json'):
                path = os.path.join(root, file)
                try:
                    mtime = os.path.getmtime(path)
                    rel_path = os.path.relpath(path, static_dir)
                    file_mtimes[rel_path] = mtime
                except Exception as e:
                    app.logger.error("初始化文件 %s 失败: %s", file, e)
    while True:
        for root, dirs, files in os.walk(static_dir):
            for file in files:
                if file.lower().endswith('.json'):
                    path = os.path.join(root, file)
                    try:
                        mtime = os.path.getmtime(path)
                        rel_path = os.path.relpath(path, static_dir)
                        if rel_path not in file_mtimes or file_mtimes[rel_path] != mtime:
                            file_mtimes[rel_path] = mtime
                            # 对于特定文件（如 events.json 或 todo.json）推送单独更新
                            if file in ['events.json', 'todo.json']:
                                try:
                                    with file_lock:
                                        with open(path, 'r', encoding='utf-8') as f:
                                            data = json.load(f)
                                    socketio.emit(file.split('.')[0] + '_updated', data)
                                    app.logger.info("推送 %s 更新", file)
                                except Exception as e:
                                    app.logger.error("读取 %s 失败: %s", file, e)
                            # 推送通用更新事件
                            socketio.emit('static_updated', {'file': rel_path})
                            app.logger.info("推送 static 文件更新: %s", rel_path)
                    except Exception as e:
                        app.logger.error("检查文件 %s 失败: %s", file, e)
        socketio.sleep(1)

# 后台管理部分

# 定义数据库模型
class Event(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    date = db.Column(db.String(20))
    description = db.Column(db.String(200))
    def __repr__(self):
        return f'<Event {self.date} - {self.description}>'

# 自定义 AdminIndexView，要求认证
class MyAdminIndexView(AdminIndexView):
    @expose('/')
    @auth.login_required
    def index(self):
        return super(MyAdminIndexView, self).index()

# 自定义 ModelView，要求认证
class MyModelView(ModelView):
    def is_accessible(self):
        auth_data = request.authorization
        if auth_data and auth_data.username in users and check_password_hash(users.get(auth_data.username), auth_data.password):
            return True
        return False

    def inaccessible_callback(self, name, **kwargs):
        return Response(
            'Authentication required', 401,
            {'WWW-Authenticate': 'Basic realm="Login Required"'}
        )

# 自定义支持编辑多个 JSON 文件的视图，要求认证
class MultiJSONAdminView(BaseView):
    @expose('/', methods=['GET', 'POST'])
    @auth.login_required
    def index(self):
        static_dir = current_app.static_folder
        json_files = []
        for root, dirs, files in os.walk(static_dir):
            rel_dir = os.path.relpath(root, static_dir)
            for file in files:
                if file.lower().endswith('.json'):
                    rel_path = os.path.join(rel_dir, file) if rel_dir != '.' else file
                    json_files.append(rel_path)
        filename = request.args.get('filename', json_files[0] if json_files else None)
        error = None
        file_content = ""
        if filename:
            json_path = os.path.join(static_dir, filename)
            if os.path.exists(json_path):
                try:
                    with file_lock:
                        with open(json_path, 'r', encoding='utf-8') as f:
                            data = json.load(f)
                    file_content = json.dumps(data, ensure_ascii=False, indent=4)
                except Exception as e:
                    error = f"读取 {filename} 失败: " + str(e)
            else:
                error = f"文件 {filename} 不存在。"
        if request.method == 'POST' and filename:
            json_text = request.form.get('json_text')
            try:
                data = json.loads(json_text)
                json_path = os.path.join(static_dir, filename)
                with file_lock:
                    with open(json_path, 'w', encoding='utf-8') as f:
                        json.dump(data, f, ensure_ascii=False, indent=4)
                # 触发更新通知
                socketio.emit('static_updated', {'file': filename})
                if filename in ['events.json', 'todo.json']:
                    try:
                        with file_lock:
                            with open(json_path, 'r', encoding='utf-8') as f:
                                data = json.load(f)
                        socketio.emit(filename.split('.')[0] + '_updated', data)
                        app.logger.info("推送 %s 更新", filename)
                    except Exception as e:
                        app.logger.error("读取 %s 失败: %s", filename, e)
                return redirect(url_for('.index', filename=filename))
            except Exception as e:
                error = "提交数据格式有误: " + str(e)
                file_content = json_text
        return self.render('admin/multi_json_edit.html',
                           json_text=file_content,
                           error=error,
                           json_files=json_files,
                           current_file=filename)

    def is_accessible(self):
        auth_data = request.authorization
        if auth_data and auth_data.username in users and check_password_hash(users.get(auth_data.username), auth_data.password):
            return True
        return False

    def inaccessible_callback(self, name, **kwargs):
        return Response(
            'Authentication required', 401,
            {'WWW-Authenticate': 'Basic realm="Login Required"'}
        )

# 初始化 Flask-Admin
admin = Admin(app, name='后台管理', template_mode='bootstrap3', index_view=MyAdminIndexView())
admin.add_view(MyModelView(Event, db.session))
admin.add_view(MultiJSONAdminView(name='JSON 管理', endpoint='json_admin'))

if __name__ == '__main__':
    with app.app_context():
        db.create_all()

    input_dir = os.path.join(app.static_folder, 'images')
    output_dir = os.path.join(app.static_folder, 'thumbnails')
    threading.Thread(
        target=generate_thumbnails_async,
        args=(input_dir, output_dir, (300, 300), 4)
    ).start()

    # 启动后台任务：监控 static 下所有 .json 文件的变化
    socketio.start_background_task(target=monitor_events)

    # 启动 Flask 应用，启用 HTTPS（请修改为你本地的证书路径）
    ssl_context = (r'E:\OneDrive\Gits\Sandshark\flask_app\certs\cert.pem',
                   r'E:\OneDrive\Gits\Sandshark\flask_app\certs\key.pem')
    socketio.run(app, host='0.0.0.0', port=5000, ssl_context=ssl_context)
