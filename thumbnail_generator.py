import os
from PIL import Image
import concurrent.futures
from datetime import datetime

# 错误日志文件路径（可根据需要修改）
ERROR_LOG_FILE = "thumbnail_errors.txt"

def log_error(message):
    """将错误信息附带日期和时间追加写入 ERROR_LOG_FILE 文件中。"""
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    with open(ERROR_LOG_FILE, "a", encoding="utf-8") as f:
        f.write(f"{now} - {message}\n")

def _process_file(input_path, output_path, size):
    """
    处理单个文件：若缩略图已存在，则跳过；否则打开图片生成缩略图并保存。
    使用 try/except 捕获异常，确保遇到异常时不会中断其他图片的处理。
    """
    if os.path.exists(output_path):
        print("缩略图已存在：", output_path)
        return
    try:
        with Image.open(input_path) as img:
            # 保持原图比例，缩放至不超过指定 size
            img.thumbnail(size)
            img.save(output_path)
            print("生成缩略图：", output_path)
    except Exception as e:
        error_msg = f"处理失败： {input_path} {e}"
        print(error_msg)
        log_error(error_msg)

def generate_thumbnails_async(input_dir, output_dir, size=(300, 300), max_workers=4):
    """
    异步生成缩略图：递归遍历 input_dir 中的图片，若输出目录中对应文件不存在，则生成缩略图。
    使用进程池并发处理任务，每个任务出现异常时跳过并写入日志文件。

    :param input_dir: 原图目录，例如 'static/images'
    :param output_dir: 缩略图输出目录，例如 'static/thumbnails'
    :param size: 缩略图尺寸，默认为 (300, 300)
    :param max_workers: 进程池中最大工作进程数，默认 4
    """
    tasks = []
    with concurrent.futures.ProcessPoolExecutor(max_workers=max_workers) as executor:
        for root, dirs, files in os.walk(input_dir):
            try:
                # 获取相对于 input_dir 的目录结构
                rel_dir = os.path.relpath(root, input_dir)
                output_subdir = os.path.join(output_dir, rel_dir)
                if not os.path.exists(output_subdir):
                    os.makedirs(output_subdir)
            except Exception as e:
                error_msg = f"创建目录失败： {output_subdir} {e}"
                print(error_msg)
                log_error(error_msg)
                continue

            for file in files:
                if file.lower().endswith(('.jpg', '.jpeg', '.png', '.gif')):
                    input_path = os.path.join(root, file)
                    output_path = os.path.join(output_subdir, file)
                    try:
                        tasks.append(executor.submit(_process_file, input_path, output_path, size))
                    except Exception as e:
                        error_msg = f"提交任务失败： {input_path} {e}"
                        print(error_msg)
                        log_error(error_msg)
        # 等待所有任务完成；单个任务的异常已在 _process_file 中捕获，
        # 这里再捕获整体任务异常以防万一
        for future in concurrent.futures.as_completed(tasks):
            try:
                future.result()
            except Exception as e:
                error_msg = f"任务异常： {e}"
                print(error_msg)
                log_error(error_msg)
