const { app, BrowserWindow, BrowserView, ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');
const https = require('https');
const express = require('express');

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

// SSL 证书路径（请根据实际路径配置）
const sslOptions = {
  key: fs.readFileSync(path.join(__dirname, 'certs/key.pem')),
  cert: fs.readFileSync(path.join(__dirname, 'certs/cert.pem'))
};

/**
 * 创建主窗口
 */
function createMainWindow() {
  mainWindow = new BrowserWindow({
    fullscreen: true,
    webPreferences: {
      nodeIntegration: true,    // 渲染进程可用 Node（注意安全问题）
      contextIsolation: false
    }
  });

  // 打开开发者工具
  mainWindow.webContents.openDevTools();

  // 去除菜单栏
  mainWindow.setMenu(null);

  // 加载初始 URL（登录页或主页）
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
}

/**
 * 节流函数：限制 func 在 delay 毫秒内仅执行一次
 * @param {Function} func 
 * @param {number} delay 
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
 * @param {string} url 
 * @returns {number} 新标签页 id
 */
function createTab(url = 'https://www.bilibili.com') {
  let tabId = nextTabId++;
  let view = new BrowserView({
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });
  view.webContents.loadURL(url);
  view.webContents.setWindowOpenHandler(({ url }) => {
    // 禁止弹窗，新窗口均在当前 BrowserView 加载
    view.webContents.loadURL(url);
    return { action: 'deny' };
  });
  tabs.push({ id: tabId, view, url });
  return tabId;
}

/**
 * 设置当前激活的标签页
 * @param {number} tabId 
 */
function setActiveTab(tabId) {
  if (activeTabId !== null) {
    const current = tabs.find(tab => tab.id === activeTabId);
    if (current) {
      mainWindow.removeBrowserView(current.view);
    }
  }
  activeTabId = tabId;
  const newActive = tabs.find(tab => tab.id === tabId);
  if (newActive) {
    mainWindow.setBrowserView(newActive.view);
    const { width, height } = mainWindow.getContentBounds();
    newActive.view.setBounds({ x: 0, y: 140, width, height: height - 140 });
  }
}

/* ------------- IPC 接口定义 ------------- */

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
ipcMain.handle('get-tabs', () => {
  return tabs.map(tab => ({ id: tab.id, url: tab.url }));
});

// 退出浏览器：移除并销毁所有 BrowserView，确保页面立即关闭
ipcMain.handle('exit-browser', () => {
  tabs.forEach(tab => {
    try {
      mainWindow.removeBrowserView(tab.view);
    } catch (e) {
      console.error(e);
    }
    tab.view.destroy();
  });
  tabs = [];
  activeTabId = null;
  // 通知渲染进程，执行切换回原始 UI的操作
  mainWindow.webContents.send('browser-exited');
});

// 启动 HTTPS 服务器（用于后端接口等）
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
