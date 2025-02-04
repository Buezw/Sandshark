const { app, BrowserWindow, BrowserView, ipcMain } = require('electron');
const http = require('http');

let mainWindow;
let browserView;
let isBrowserVisible = false;

function waitForFlaskAndLoadURL() {
  http.get('http://127.0.0.1:5000', res => {
    console.log('Flask server is ready, loading URL...');
    mainWindow.loadURL('http://127.0.0.1:5000');
  }).on('error', err => {
    console.log('Flask not ready yet, retrying in 500ms...');
    setTimeout(waitForFlaskAndLoadURL, 500);
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1024,
    height: 768,
    webPreferences: {
      nodeIntegration: true,       // 启用 nodeIntegration 以便在页面中使用 ipcRenderer
      contextIsolation: false
    }
  });

  // 自动传递 HTTP Basic 认证信息给 Flask
  mainWindow.webContents.on('login', (event, request, authInfo, callback) => {
    event.preventDefault();
    callback('Buezwqwg', 'F40orte,,');
  });

  waitForFlaskAndLoadURL();

  // 创建 BrowserView 对象，用于内置浏览器
  browserView = new BrowserView();
  browserView.webContents.loadURL('https://www.bilibili.com');

  // 默认不显示 BrowserView，等待点击按钮后通过 IPC 显示
  ipcMain.on('toggle-browser', () => {
    if (isBrowserVisible) {
      mainWindow.removeBrowserView(browserView);
      isBrowserVisible = false;
    } else {
      mainWindow.setBrowserView(browserView);
      // 设置 BrowserView 的位置和大小（覆盖顶部菜单栏下方区域）
      const { width, height } = mainWindow.getContentBounds();
      browserView.setBounds({ x: 0, y: 60, width: width, height: height - 60 });
      isBrowserVisible = true;
    }
  });

  // 主窗口尺寸改变时调整 BrowserView 大小
  mainWindow.on('resize', () => {
    if (isBrowserVisible) {
      const { width, height } = mainWindow.getContentBounds();
      browserView.setBounds({ x: 0, y: 60, width: width, height: height - 60 });
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.on('ready', createWindow);
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
app.on('activate', () => {
  if (mainWindow === null) createWindow();
});
