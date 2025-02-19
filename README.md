# 项目名称

本项目是一个基于 **Electron** 与 **Flask** 的跨平台综合应用，涵盖了多标签浏览器、相册管理、实时热搜爬取、JSON 文件编辑管理等多功能模块。项目在技术栈上采用了多进程架构（Electron 主进程 + Flask 后端 + 子进程并发任务）以及前后端分离式的通信模式，通过多种专有技术与框架实现了丰富而高效的功能。

---

## 功能概览

- **多标签浏览器 (Browser)**
  - 基于 **Electron** 的 Chromium 渲染进程，使用 `BrowserWindow` 与 `BrowserView` 的多进程架构
  - 标签页的增删改查及书签功能，利用 `ipcMain` 和 `ipcRenderer` 进行双向 IPC 通信
  - 自签名证书支持及忽略证书验证选项，便于在内网或测试环境进行 HTTPS 通讯

- **相册管理 (Album)**
  - 递归扫描文件夹并生成图片缩略图，使用 Python 的 **Pillow** 库与 `concurrent.futures` 并发池
  - 前端懒加载及滑动缩放等动画效果，结合 `IntersectionObserver` 和 CSS3 过渡特性
  - 点击预览原图，全屏展示大分辨率图片

- **热搜爬虫 (Trends)**
  - 借助 **Playwright** 进行无头浏览器自动化，爬取 rebang.today 及 Google Trends
  - 后端按固定周期调度爬虫脚本 `trends_crawler.py`，然后将结果写入 `trends.json`
  - 前端调用 Flask API 或通过 SocketIO 获取最新数据并实时渲染

- **JSON 文件管理 (Multi JSON Admin)**
  - 后台基于 **Flask-Admin** 的定制视图，可同时列出多个 JSON 文件进行编辑
  - 使用 Python 内置的 `json` 模块读写配置文件（如 `events.json`, `todo.json` 等）
  - 提供自动刷新机制，当 JSON 文件发生改动时通过 SocketIO 通知前端

- **实时数据更新**
  - 借助 **Flask-SocketIO** 建立 WebSocket 长连接，监听文件变动并向前端推送
  - 前端基于 `socket.io.min.js` 订阅消息，实现页面数据的动态刷新（如实时日程变动、待办事项更新）

---

## 技术栈与关键点

1. **Electron 桌面应用**
   - 多进程模型：主进程负责创建窗口与管理 BrowserView，渲染进程负责页面 UI 和业务逻辑
   - `ignore-certificate-errors`：在内网或测试环境下忽略不受信任的证书
   - `nodeIntegration` 与 `contextIsolation` 配置：选择性地暴露 Node.js API，提升安全性

2. **Node.js & NPM**
   - Electron 依赖的运行时环境
   - 通过 `npm` 安装前端依赖包，并执行 `npm start` 启动 Electron 应用

3. **Flask (Python)**
   - WSGI 微框架，处理 HTTP/HTTPS 请求，提供 RESTful API
   - `HTTPBasicAuth` 验证 & 账号密码哈希存储，确保后端接口不会被未经授权的访问
   - `CORS` 设置与 Session 管理：通过跨域资源共享允许 Electron 前端调用后端接口

4. **Playwright 爬虫**
   - 使用无头浏览器在 “rebang.today” 与 “Google Trends” 上抓取文本
   - 自动化操作与选择器等待机制，确保抓取成功率
   - 定时或手动执行 `trends_crawler.py`，在 `trends.json` 中记录最新爬取结果

5. **SQLAlchemy + SQLite**
   - 关系型数据库支持
   - 使用 ORM (对象关系映射) 定义模型如 `Event`，在 **Flask-Admin** 中可视化增删改查

6. **Flask-SocketIO**
   - 实时通信层，监听 `static` 目录下 JSON 文件修改时间 (mtime) 并向前端推送
   - 前端订阅 `events_updated`, `todo_updated` 等 SocketIO 频道，实现秒级更新

7. **Pillow (PIL) + 多进程并发**
   - `thumbnail_generator.py` 中借助 `ProcessPoolExecutor` 生成缩略图
   - 遇到错误或异常时记录到错误日志
   - 大批量图片处理时不会阻塞主线程，提升响应速度

8. **JSON 读写与数据管理**
   - 后端使用 Python `json` 标准库安全读写配置文件和用户数据文件
   - 前端通过 `fetch` / `Ajax` / `SocketIO` 等方式获取或提交 JSON 数据
   - 多文件统一编辑界面：通过 **Flask-Admin** 自定义 **BaseView** (`MultiJSONAdminView`) 实现

9. **HTML / CSS3 / JavaScript**
   - 使用 `Grid` 和 `Flexbox` 布局构建响应式页面，如 `browser.html`, `album.html`, `trends.html` 等
   - CSS3 动画与过渡：图片相册缩放、卡片阴影、鼠标悬浮样式
   - 事件绑定 (如点击、滑动) + DOM 操作，增强交互性和用户体验

10. **安全与证书配置**
    - HTTPS 加密通信：Flask 可加载 SSL 证书和密钥 (`.pem`)，Electron 端忽略自签名错误
    - 基于 BasicAuth 的接口认证：防止外部环境下任意访问管理页面或文件编辑功能
    - 生产环境可设置更严格的头部安全策略，如 HSTS、X-Frame-Options 等

---

## 安装与启动

1. **克隆项目：**
   ```bash
   git clone <仓库地址>
   cd <项目目录>
   ```

2. **安装依赖：**
   - 安装 Node 依赖
     ```bash
     npm install
     ```
   - 安装 Python 依赖
     ```bash
     pip install -r requirements.txt
     ```
3. **启动 Flask 后端：**
   ```bash
   python app.py
   ```
   - 默认监听 5000 端口
   - 可在生产环境配置 SSL 证书实现 HTTPS

4. **启动 Electron 应用：**
   ```bash
   npm start
   ```
   - 将自动创建主窗口并加载 Flask 提供的页面

---

## 使用说明

- **Electron 浏览器**  
  - 自定义多标签页切换，地址栏输入链接后加载页面，书签管理等  
  - 在开发/测试环境忽略自签名证书，正式环境可移除或替换为可信证书

- **相册模块**  
  - 前端懒加载缩略图，点击可查看原图大尺寸预览  
  - 服务端可随时新增或删除 `images/` 下图片，后台会自动生成或删除对应缩略图

- **热搜趋势**  
  - 运行 `trends_crawler.py` 更新 `trends.json`，也可结合 Crontab 或系统 Task Scheduler 定时执行  
  - 前端 `trends.html` 会读取并显示最新的榜单内容

- **后台管理**  
  - 访问 `http(s)://<服务器地址>:5000/admin` 进入 Flask-Admin  
  - 管理 SQLite 数据库中的事件、用户信息；  
  - 访问 `http(s)://<服务器地址>:5000/multi_json_edit` 编辑多个 JSON 文件

---

## 注意事项

- **BasicAuth** 与证书安全：  
  - 在 `static/config.json` 中存储了用户名/哈希密码，务必保护此文件  
  - 建议在生产环境中使用真实的可信 CA 证书并启用 HSTS

- **全屏/无边框**：  
  - Electron 默认以全屏启动开发者工具，提交正式版本时可移除 `openDevTools()` 并自定义窗口大小

- **配置扩展**：  
  - 若需要持久化或二次开发，可以将 Flask 的蓝图与数据库模型做进一步抽象  
  - 也可对 Electron 的主进程脚本加以扩展，实现更多 IPC 通信或插件机制

- **异常处理**：  
  - Pillow 缩略图生成时，如果个别图片损坏会被跳过并记录到错误日志  
  - 爬虫脚本若遇到网络超时也会在终端提示

---

## 许可证

本项目遵循 [MIT License](./LICENSE)，欢迎二次开发与功能扩展。如在生产环境使用，请务必注意安全与证书策略。

```