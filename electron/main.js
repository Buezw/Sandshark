const { app, BrowserWindow, BrowserView, ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');

let mainWindow;
let tabs = [];           // 存储各个标签 { id, view, url }
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

function createMainWindow() {
  mainWindow = new BrowserWindow({
    fullscreen: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  mainWindow.setMenu(null);
  // 修改为加载 Flask 服务的 URL
  mainWindow.loadURL('http://Buezwqwg:F40orte%2C%2C@172.16.34.188:5000');


  mainWindow.on('resize', throttle(() => {
    if (activeTabId !== null) {
      const activeTab = tabs.find(tab => tab.id === activeTabId);
      if (activeTab) {
        const { width, height } = mainWindow.getContentBounds();
        activeTab.view.setBounds({ x: 0, y: 140, width, height: height - 140 });
      }
    }
  }, 100));

  const eventsFilePath = path.join(__dirname, '../flask_app/static', 'events.json');
  fs.watch(eventsFilePath, (eventType, filename) => {
    if (filename && eventType === 'change') {
      mainWindow.webContents.send('events-updated');
    }
  });
}

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
    view.webContents.loadURL(url);
    return { action: 'deny' };
  });

  // 删除了历史记录相关功能，此处不再记录导航历史

  tabs.push({ id: tabId, view, url });
  return tabId;
}

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

// IPC 接口
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
ipcMain.handle('navigate-to', (event, tabId, url) => {
  const tab = tabs.find(t => t.id === tabId);
  if (tab) {
    tab.url = url;
    tab.view.webContents.loadURL(url);
  }
  return tabId;
});
ipcMain.handle('get-bookmarks', () => bookmarks);
ipcMain.handle('add-bookmark', (event, bookmark) => {
  bookmarks.push(bookmark);
  fs.writeFileSync(bookmarkFilePath, JSON.stringify(bookmarks));
  return bookmarks;
});

// 后退与刷新接口
ipcMain.handle('go-back', (event, tabId) => {
  const tab = tabs.find(t => t.id === tabId);
  if (tab && tab.view.webContents.canGoBack()) {
    tab.view.webContents.goBack();
  }
  return tabId;
});
ipcMain.handle('reload-tab', (event, tabId) => {
  const tab = tabs.find(t => t.id === tabId);
  if (tab) {
    tab.view.webContents.reload();
  }
  return tabId;
});

ipcMain.on('toggle-browser', () => {
  if (activeTabId !== null) {
    const current = tabs.find(tab => tab.id === activeTabId);
    if (current) mainWindow.removeBrowserView(current.view);
  }
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
