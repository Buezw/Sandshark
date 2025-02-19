const { app, BrowserWindow, BrowserView, ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');
const https = require('https');

app.commandLine.appendSwitch('ignore-certificate-errors');

// 全局变量：主窗口、标签页数组、当前激活标签、下一个标签 ID、书签数组
let mainWindow;
let tabs = [];           // 格式：{ id, view, url }
let activeTabId = null;
let nextTabId = 1;
let bookmarks = [];

// 书签文件路径及加载
const bookmarkFilePath = path.join(__dirname, 'bookmarks.json');
if (fs.existsSync(bookmarkFilePath)) {
  try {
    bookmarks = JSON.parse(fs.readFileSync(bookmarkFilePath, 'utf8'));
  } catch (err) {
    bookmarks = [];
  }
} else {
  bookmarks = [];
}

// SSL 证书路径（如 Electron 内部也需要使用 SSL）
const sslOptions = {
  key: fs.readFileSync(path.join(__dirname, 'certs/key.pem')),
  cert: fs.readFileSync(path.join(__dirname, 'certs/cert.pem'))
};

/**
 * 创建主窗口，初始加载 Flask 的主页 URL
 */
function createMainWindow() {
  mainWindow = new BrowserWindow({
    fullscreen: true,
    webPreferences: {
      nodeIntegration: true,    // 启用 Node 集成（仅用于渲染进程）
      contextIsolation: false   // 关闭上下文隔离
    }
  });

  // 打开开发者工具
  mainWindow.webContents.openDevTools();

  // 去除菜单栏
  mainWindow.setMenu(null);

  // 加载 Flask 的主页（含认证信息，确保与 Flask 端账号密码一致）
  mainWindow.loadURL('https://Buezwqwg:F40orte%2C%2C@100.68.21.31:5000');

  // 当窗口大小变化时，调整当前激活标签页的 BrowserView 大小
  mainWindow.on('resize', throttle(() => {
    if (activeTabId !== null) {
      const activeTab = tabs.find(tab => tab.id === activeTabId);
      if (activeTab) {
        const { width, height } = mainWindow.getContentBounds();
        activeTab.view.setBounds({ x: 0, y: 140, width, height: height - 140 });
      }
    }
  }, 100));
}

/**
 * 节流函数：限制 func 在 delay 毫秒内仅执行一次
 * @param {Function} func - 需要执行的函数
 * @param {number} delay - 延迟时间（毫秒）
 */
function throttle(func, delay) {
  let timeout = null;
  return () => {
    if (!timeout) {
      timeout = setTimeout(() => {
        func();
        timeout = null;
      }, delay);
    }
  };
}

/**
 * 创建新的标签页（BrowserView）
 * @param {string} url - 标签页加载的 URL，默认使用 bilibili 网站
 * @returns {number} 新标签页的 id
 */
function createTab(url = 'https://www.bilibili.com') {
  let tabId = nextTabId++;
  let view = new BrowserView({
    webPreferences: {
      nodeIntegration: false,  // 禁用 Node 集成
      contextIsolation: true     // 开启上下文隔离
    }
  });
  view.webContents.loadURL(url);
  view.webContents.setWindowOpenHandler(({ url }) => {
    view.webContents.loadURL(url);
    return { action: 'deny' };
  });
  tabs.push({ id: tabId, view, url });
  return tabId;
}

/**
 * 设置当前激活的标签页
 * @param {number} tabId - 要激活的标签页 id
 */
function setActiveTab(tabId) {
  if (activeTabId !== null) {
    const current = tabs.find(tab => tab.id === activeTabId);
    if (current) mainWindow.removeBrowserView(current.view);
  }
  activeTabId = tabId;
  const newActive = tabs.find(tab => tab.id === tabId);
  if (newActive) {
    mainWindow.setBrowserView(newActive.view);
    const { width, height } = mainWindow.getContentBounds();
    newActive.view.setBounds({ x: 0, y: 140, width, height: height - 140 });
  }
}

/* -------------------- IPC 接口定义 -------------------- */

// 创建新标签页
ipcMain.handle('create-tab', (event, url) => {
  let tabId = createTab(url);
  setActiveTab(tabId);
  return tabId;
});

// 切换标签页
ipcMain.handle('switch-tab', (event, tabId) => {
  setActiveTab(tabId);
  return tabId;
});

// 关闭指定标签页
ipcMain.handle('close-tab', (event, tabId) => {
  const index = tabs.findIndex(tab => tab.id === tabId);
  if (index !== -1) {
    if (activeTabId === tabId) {
      mainWindow.removeBrowserView(tabs[index].view);
    }
    tabs.splice(index, 1);
    if (activeTabId === tabId) {
      if (tabs.length > 0) {
        setActiveTab(tabs[0].id);
      } else {
        activeTabId = null;
      }
    }
  }
  return tabs.map(tab => ({ id: tab.id, url: tab.url }));
});

// 获取所有标签页信息
ipcMain.handle('get-tabs', () => tabs.map(tab => ({ id: tab.id, url: tab.url })));


// 新增 IPC 接口：打开浏览器页面（加载 Flask 返回 browser.html 页面）
ipcMain.handle('open-browser', () => {
  // 这里使用 /browser 路由，并附带认证信息
  mainWindow.loadURL('https://Buezwqwg:F40orte%2C%2C@100.68.21.31:5000/browser');
});

ipcMain.handle('exit-browser', () => {
  // 获取所有附加的 BrowserView
  const views = mainWindow.getBrowserViews();
  views.forEach(view => {
    mainWindow.removeBrowserView(view);
    if (typeof view.destroy === 'function') {
      view.destroy();
    }
  });
  
  // 确保没有 BrowserView 附加在窗口上
  mainWindow.setBrowserView(null);
  
  // 清空 tabs 及 activeTabId
  tabs = [];
  activeTabId = null;
  
  // 加载指定 URL
  mainWindow.loadURL('https://Buezwqwg:F40orte%2C%2C@172.16.34.188:5000');
});


// Photoview
ipcMain.handle('open-album', () => {
  // 进入 Photoview
  mainWindow.loadURL('https://Buezwqwg:F40orte%2C%2C@100.68.21.31:5000/album');
});

ipcMain.handle('exit-album', () => {
  // 加载指定 URL
  mainWindow.loadURL('https://Buezwqwg:F40orte%2C%2C@100.68.21.31:5000');
});

// Functions
ipcMain.handle('open-functions', () => {
  // 进入 Photoview
  mainWindow.loadURL('https://Buezwqwg:F40orte%2C%2C@100.68.21.31:5000/functions');
});

ipcMain.handle('exit-functions', () => {
  // 加载指定 URL
  mainWindow.loadURL('https://Buezwqwg:F40orte%2C%2C@100.68.21.31:5000');
});

// Trends
ipcMain.handle('open-trends', () => {
  // 进入 Trends
  mainWindow.loadURL('https://Buezwqwg:F40orte%2C%2C@100.68.21.31:5000/trends');
});

ipcMain.handle('exit-trends', () => {
  // 加载指定 URL
  mainWindow.loadURL('https://Buezwqwg:F40orte%2C%2C@100.68.21.31:5000');
});


/* -------------------- 应用生命周期 -------------------- */

app.whenReady().then(() => {
  createMainWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
});

// 此处启动一个 HTTPS 服务器（仅为示例，实际 Flask 服务由 Flask 启动）
const server = https.createServer(sslOptions, (req, res) => {
  res.writeHead(200);
  res.end();
});

server.listen(5000, () => {
  console.log('HTTPS server running on https://localhost:5000');
});
