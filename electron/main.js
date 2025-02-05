const { app, BrowserWindow, BrowserView, ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');
const https = require('https');  // 导入 https 模块
const express = require('express');  // 引入 express 模块，用于 HTTPS 服务器

app.commandLine.appendSwitch('ignore-certificate-errors');
// 全局变量：主窗口、标签页数组、当前激活标签、下一个标签 ID、书签数组
let mainWindow;
let tabs = [];           // 存储各个标签页，格式为 { id, view, url }
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

// SSL 证书路径
const sslOptions = {
  key: fs.readFileSync(path.join(__dirname, 'certs/key.pem')),  // 你的私钥文件路径
  cert: fs.readFileSync(path.join(__dirname, 'certs/cert.pem'))    // 你的证书文件路径
};

/**
 * 创建主窗口
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

  // 根据实际情况修改登录 URL（若后端认证信息已由前端通过请求头传递，可以移除 URL 中的凭证）
  mainWindow.loadURL('https://Buezwqwg:F40orte%2C%2C@172.16.34.188:5000');

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

  // 由于 events 更新通过后端 WebSocket 推送到前端，此处不再监控本地 events 文件
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

ipcMain.handle('create-tab', (event, url) => {
  let tabId = createTab(url);
  setActiveTab(tabId);
  return tabId;
});

ipcMain.handle('switch-tab', (event, tabId) => {
  setActiveTab(tabId);
  return tabId;
});

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

ipcMain.handle('get-tabs', () => tabs.map(tab => ({ id: tab.id, url: tab.url })));

// 更改后端 HTTPS 配置
const server = https.createServer(sslOptions, (req, res) => {
  res.writeHead(200);
  res.end();
});

app.whenReady().then(() => {
  createMainWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
});

// 启动 HTTPS 服务器
server.listen(5000, () => {
  console.log('HTTPS server running on https://localhost:5000');
});
