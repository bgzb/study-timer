const fs = require('fs');
const path = require('path');

function createSharedStateStore({ app, BrowserWindow, ipcMain }) {
  const sharedDir = path.join(app.getPath('home'), 'Library', 'Application Support', 'study-timer-shared');
  const stateFile = path.join(sharedDir, 'state.json');
  let lastMtime = 0;
  let watchDebounce = null;
  let pollTimer = null;
  let watcher = null;

  function read() {
    try { return JSON.parse(fs.readFileSync(stateFile, 'utf8')) || {}; } catch (e) { return {}; }
  }
  function broadcast(excludeWC) {
    for (const w of BrowserWindow.getAllWindows()) {
      if (!w.isDestroyed() && w.webContents !== excludeWC) w.webContents.send('state:sync');
    }
  }
  function write(obj, excludeWC) {
    try {
      fs.mkdirSync(sharedDir, { recursive: true });
      const tmp = stateFile + '.tmp-' + process.pid;
      fs.writeFileSync(tmp, JSON.stringify(obj));
      fs.renameSync(tmp, stateFile);
      lastMtime = fs.statSync(stateFile).mtimeMs;
      broadcast(excludeWC);
    } catch (e) { console.warn('[study-timer] shared state write failed:', e.message); }
  }
  function checkChanged() {
    try {
      const mtime = fs.statSync(stateFile).mtimeMs;
      if (mtime !== lastMtime) { lastMtime = mtime; broadcast(); }
    } catch (e) {}
  }
  function startWatching() {
    try { lastMtime = fs.statSync(stateFile).mtimeMs; } catch (e) {}
    try {
      watcher = fs.watch(sharedDir, () => {
        clearTimeout(watchDebounce);
        watchDebounce = setTimeout(checkChanged, 120);
      });
    } catch (e) {}
    pollTimer = setInterval(checkChanged, 5000);
  }
  function stopWatching() {
    if (watcher) { try { watcher.close(); } catch (e) {} watcher = null; }
    if (watchDebounce) clearTimeout(watchDebounce);
    if (pollTimer) clearInterval(pollTimer);
  }
  function registerIpc() {
    ipcMain.on('state:load-sync', (event) => { event.returnValue = read(); });
    ipcMain.on('state:save', (event, payload) => {
      if (!payload || typeof payload !== 'object' || !payload.state) return;
      const current = read();
      const next = Object.assign({}, current);
      next.state = payload.state;
      if (payload.barTheme != null) next.barTheme = payload.barTheme;
      if (payload.migratedLocal != null) next.migratedLocal = payload.migratedLocal;
      write(next, event.sender);
    });
    // 兼容旧版本页面仍可能发送的通道。
    ipcMain.on('state:changed', (event) => broadcast(event.sender));
  }
  return { sharedDir, stateFile, read, write, broadcast, startWatching, stopWatching, registerIpc };
}

module.exports = { createSharedStateStore };
