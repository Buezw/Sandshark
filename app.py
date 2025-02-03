from flask import Flask, render_template, jsonify
import os
import threading
from thumbnail_generator import generate_thumbnails_async

app = Flask(__name__)

# 首页路由
@app.route('/')
def index():
    return render_template('home_page.html')

# 照片浏览页面，路由为 /photoview
@app.route('/photoview')
def photoview():
    return render_template('photoview.html')

# 示例 API 路由
@app.route('/api/data', methods=['GET'])
def get_data():
    return {"message": "Hello from Flask in LAN!"}

# API 接口：返回 static/images 下各子文件夹及图片列表
@app.route('/api/folders', methods=['GET'])
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
    
    # 启动服务器，监听 0.0.0.0，局域网内可访问
    app.run(host='0.0.0.0', port=5000)
