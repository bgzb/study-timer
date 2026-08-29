const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('studyTimer', {
  isElectron: true,
  updateTray: (title, tooltip) => ipcRenderer.send('tray:update', { title, tooltip }),
  showWindow: () => ipcRenderer.send('win:show'),
  setAutostart: (v) => ipcRenderer.send('autostart:set', v),
  getAutostart: () => ipcRenderer.invoke('autostart:get'),
  restartApp: () => ipcRenderer.send('app:restart'),
  playSound: (file, volume) => ipcRenderer.send('sound:play', { file, volume }),
  openNotificationSettings: () => ipcRenderer.send('sysprefs:notifications'),
  notify: (title, body, sound) => ipcRenderer.send('notify', { title, body, sound }),
  // 双窗口状态同步
  stateChanged: () => ipcRenderer.send('state:changed'),
  onStateSync: (cb) => ipcRenderer.on('state:sync', () => cb()),
  // 菜单栏面板
  hideBar: () => ipcRenderer.send('bar:hide'),
  resizeBar: (w, h) => ipcRenderer.send('bar:resize', { w, h }),
  setBarVibrancy: (on) => ipcRenderer.send('bar:vibrancy', on),
  // 每日总结窗口（date 为 'YYYY-MM-DD'；focus=true 抢焦点，false 柔和弹出）
  openSummary: (date, focus) => ipcRenderer.send('summary:open', { date, focus })
});
