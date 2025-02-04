const { app, BrowserWindow, BrowserView, ipcMain } = require('electron');

let mainWindow;
let tabs = [];           // 存储各标签 { id, view, url }
let activeTabId = null;
let nextTabId = 1;
let bookmarks = [];      // 收藏夹数组，格式：{ title, url }
let historyData = [];    // 历史记录数组，格式：{ tabId, url, title, time }

function createMainWindow() {
  mainWindow = new BrowserWindow({
    fullscreen: true, // 全屏模式
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });
  //mainWindow.webContents.openDevTools();
  mainWindow.setMenu(null);
  // 请根据实际情况调整路径
  mainWindow.loadFile('../flask_app/templates/home_page.html');

  // 节流处理 resize 事件，每 100ms 调用一次
  mainWindow.on('resize', throttle(() => {
    if (activeTabId !== null) {
      const activeTab = tabs.find(tab => tab.id === activeTabId);
      if (activeTab) {
        const { width, height } = mainWindow.getContentBounds();
        // 浏览器 UI 上部预留：顶部菜单 60px + 标签栏 40px + 收藏栏 40px，共 140px
        activeTab.view.setBounds({ x: 0, y: 140, width, height: height - 140 });
      }
    }
  }, 100));
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
  }
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

  // 拦截 window.open，在当前标签加载新页面
  view.webContents.setWindowOpenHandler(({ url }) => {
    view.webContents.loadURL(url);
    return { action: 'deny' };
  });

  // 导航后记录历史，采用 executeJavaScript 获取页面标题
  view.webContents.on('did-navigate', (event, url) => {
    view.webContents.executeJavaScript('document.title')
      .then(title => {
        historyData.push({
          tabId,
          url,
          title,
          time: new Date().toISOString()
        });
      })
      .catch(() => {
        historyData.push({
          tabId,
          url,
          title: url,
          time: new Date().toISOString()
        });
      });
  });

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
  return bookmarks;
});
ipcMain.handle('get-history', () => historyData);
ipcMain.on('toggle-browser', () => {
  if (activeTabId !== null) {
    const current = tabs.find(tab => tab.id === activeTabId);
    if (current) mainWindow.removeBrowserView(current.view);
  }
});

app.whenReady().then(() => {
  createMainWindow();
  // 默认启动时只显示原始 UI，不新建浏览器标签
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
});
