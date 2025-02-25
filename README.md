（由于技术原因，联网搜索暂不可用）

# Project Name

This project is a cross-platform comprehensive application based on **Electron** and **Flask**, covering multiple functional modules such as a multi-tab browser, photo album management, real-time hot search crawling, JSON file editing and management, and more. The project adopts a multi-process architecture (Electron main process + Flask backend + subprocess concurrent tasks) and a frontend-backend separation communication model. It implements rich and efficient functionalities through various proprietary technologies and frameworks.

---

## Feature Overview

- **Multi-tab Browser (Browser)**
  - Based on **Electron**'s Chromium rendering process, using the multi-process architecture of `BrowserWindow` and `BrowserView`
  - Add, delete, modify, and query tabs, along with bookmark functionality, utilizing `ipcMain` and `ipcRenderer` for bidirectional IPC communication
  - Self-signed certificate support and the option to ignore certificate verification, facilitating HTTPS communication in intranet or testing environments

- **Photo Album Management (Album)**
  - Recursively scan folders and generate image thumbnails using Python's **Pillow** library and `concurrent.futures` concurrent pool
  - Frontend lazy loading and sliding zoom animation effects, combining `IntersectionObserver` and CSS3 transition features
  - Click to preview the original image, with full-screen display of high-resolution images

- **Hot Search Crawler (Trends)**
  - Utilize **Playwright** for headless browser automation to crawl rebang.today and Google Trends
  - The backend schedules the crawler script `trends_crawler.py` at fixed intervals, then writes the results to `trends.json`
  - The frontend calls the Flask API or obtains the latest data via SocketIO and renders it in real-time

- **JSON File Management (Multi JSON Admin)**
  - Backend based on **Flask-Admin**'s custom views, allowing simultaneous listing and editing of multiple JSON files
  - Use Python's built-in `json` module to read and write configuration files (e.g., `events.json`, `todo.json`, etc.)
  - Provide an automatic refresh mechanism, notifying the frontend via SocketIO when JSON files are modified

- **Real-time Data Updates**
  - Use **Flask-SocketIO** to establish a WebSocket long connection, monitor file changes, and push updates to the frontend
  - The frontend subscribes to messages based on `socket.io.min.js`, enabling dynamic page data refresh (e.g., real-time schedule changes, to-do list updates)

---

## Tech Stack and Key Points

1. **Electron Desktop Application**
   - Multi-process model: The main process is responsible for creating windows and managing BrowserView, while the rendering process handles page UI and business logic
   - `ignore-certificate-errors`: Ignore untrusted certificates in intranet or testing environments
   - `nodeIntegration` and `contextIsolation` configuration: Selectively expose Node.js APIs to enhance security

2. **Node.js & NPM**
   - Runtime environment for Electron dependencies
   - Install frontend dependencies via `npm` and start the Electron application with `npm start`

3. **Flask (Python)**
   - WSGI micro-framework, handling HTTP/HTTPS requests and providing RESTful APIs
   - `HTTPBasicAuth` verification & password hashing storage, ensuring backend interfaces are not accessed without authorization
   - `CORS` settings and Session management: Allow Electron frontend to call backend APIs via cross-origin resource sharing

4. **Playwright Crawler**
   - Use headless browsers to crawl text from "rebang.today" and "Google Trends"
   - Automated operations and selector waiting mechanisms ensure crawling success rates
   - Execute `trends_crawler.py` on a schedule or manually, recording the latest results in `trends.json`

5. **SQLAlchemy + SQLite**
   - Relational database support
   - Use ORM (Object-Relational Mapping) to define models like `Event`, enabling visual CRUD operations in **Flask-Admin**

6. **Flask-SocketIO**
   - Real-time communication layer, monitoring modification times (mtime) of JSON files in the `static` directory and pushing updates to the frontend
   - Frontend subscribes to SocketIO channels like `events_updated`, `todo_updated`, etc., achieving second-level updates

7. **Pillow (PIL) + Multi-process Concurrency**
   - Use `ProcessPoolExecutor` in `thumbnail_generator.py` to generate thumbnails
   - Log errors or exceptions to error logs
   - Large-scale image processing does not block the main thread, improving response speed

8. **JSON Read/Write and Data Management**
   - Backend uses Python's `json` standard library to safely read and write configuration files and user data files
   - Frontend obtains or submits JSON data via `fetch` / `Ajax` / `SocketIO`, etc.
   - Multi-file unified editing interface: Implemented via **Flask-Admin** custom **BaseView** (`MultiJSONAdminView`)

9. **HTML / CSS3 / JavaScript**
   - Use `Grid` and `Flexbox` layouts to build responsive pages like `browser.html`, `album.html`, `trends.html`, etc.
   - CSS3 animations and transitions: Image album zooming, card shadows, hover styles
   - Event binding (e.g., clicks, swipes) + DOM operations to enhance interactivity and user experience

10. **Security and Certificate Configuration**
    - HTTPS encrypted communication: Flask can load SSL certificates and keys (`.pem`), while Electron ignores self-signed errors
    - BasicAuth-based interface authentication: Prevents unauthorized access to management pages or file editing functions in external environments
    - Production environments can enforce stricter security headers like HSTS, X-Frame-Options, etc.

---

## Installation and Startup

1. **Clone the Project:**
   ```bash
   git clone <repository URL>
   cd <project directory>
   ```

2. **Install Dependencies:**
   - Install Node dependencies
     ```bash
     npm install
     ```
   - Install Python dependencies
     ```bash
     pip install -r requirements.txt
     ```

3. **Start the Flask Backend:**
   ```bash
   python app.py
   ```
   - Listens on port 5000 by default
   - Configure SSL certificates in production environments to enable HTTPS

4. **Start the Electron Application:**
   ```bash
   npm start
   ```
   - Automatically creates the main window and loads pages provided by Flask

---

## Usage Instructions

- **Electron Browser**
  - Custom multi-tab switching, loading pages after entering URLs in the address bar, bookmark management, etc.
  - Ignore self-signed certificates in development/testing environments; remove or replace with trusted certificates in production

- **Photo Album Module**
  - Frontend lazy-loads thumbnails; click to preview the original image in large size
  - The server can add or delete images in `images/` at any time, and the backend will automatically generate or delete corresponding thumbnails

- **Hot Search Trends**
  - Run `trends_crawler.py` to update `trends.json`, or combine with Crontab or system Task Scheduler for scheduled execution
  - The frontend `trends.html` reads and displays the latest ranking content

- **Backend Management**
  - Access `http(s)://<server address>:5000/admin` to enter Flask-Admin
  - Manage events and user information in the SQLite database
  - Access `http(s)://<server address>:5000/multi_json_edit` to edit multiple JSON files

---

## Notes

- **BasicAuth and Certificate Security:**
  - Username/hashed passwords are stored in `static/config.json`; ensure this file is protected
  - Use real trusted CA certificates and enable HSTS in production environments

- **Fullscreen/Borderless:**
  - Electron starts the developer tools in full screen by default; remove `openDevTools()` and customize window size for the official release

- **Configuration Extension:**
  - For persistence or secondary development, further abstract Flask's blueprints and database models
  - Extend Electron's main process script to implement more IPC communication or plugin mechanisms

- **Exception Handling:**
  - If individual images are corrupted during Pillow thumbnail generation, they are skipped and logged in the error log
  - The crawler script will prompt in the terminal if a network timeout occurs

---

## License

This project follows the [MIT License](./LICENSE). Secondary development and feature expansion are welcome. Please pay attention to security and certificate policies when using in production environments.