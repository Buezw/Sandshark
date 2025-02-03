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

# 首页路由（需要认证）
@app.route('/')
@auth.login_required
def index():
    return render_template('home_page.html')

# 照片浏览页面，路由为 /photoview（需要认证）
@app.route('/photoview')
@auth.login_required
def photoview():
    return render_template('photoview.html')

# 示例 API 路由（需要认证）
@app.route('/api/data', methods=['GET'])
@auth.login_required
def get_data():
    return {"message": "Hello from Flask in LAN!"}

# API 接口：返回 static/images 下各子文件夹及图片列表（需要认证）
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

if __name__ == '__main__':
    # 定义原图目录与缩略图输出目录
    input_dir = os.path.join(app.static_folder, 'images')
    output_dir = os.path.join(app.static_folder, 'thumbnails')
    
    # 异步生成缩略图，放入后台线程执行，不阻塞主进程启动
    threading.Thread(
        target=generate_thumbnails_async,
        args=(input_dir, output_dir, (300, 300), 4)
    ).start()
    
    # 启动服务器，监听 0.0.0.0 使局域网设备可访问
    app.run(host='0.0.0.0', port=5000)
