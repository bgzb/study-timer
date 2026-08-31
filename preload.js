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
  // 共享状态（两个 App 经主进程读写共享 JSON 文件，跨 App 同步）
  loadAllSync: () => ipcRenderer.sendSync('state:load-sync'),
  saveAll: (all) => ipcRenderer.send('state:save', all),
  onStateSync: (cb) => ipcRenderer.on('state:sync', () => cb()),
  // 提醒职责：本窗口是否负责通知/铃声/统计（菜单栏端恒 true；桌面端在菜单栏端未运行时 true）
  getDutiesSync: () => ipcRenderer.sendSync('duties:get-sync'),
  onDutiesChange: (cb) => ipcRenderer.on('duties:change', (_e, v) => cb(v)),
  // 菜单栏面板 → 启动桌面端 App
  launchDesktop: () => ipcRenderer.send('desktop:launch'),
  // 菜单栏面板
  hideBar: () => ipcRenderer.send('bar:hide'),
  resizeBar: (w, h) => ipcRenderer.send('bar:resize', { w, h }),
  setBarVibrancy: (on) => ipcRenderer.send('bar:vibrancy', on),
  // 每日总结窗口（date 为 'YYYY-MM-DD'；focus=true 抢焦点，false 柔和弹出）
  openSummary: (date, focus) => ipcRenderer.send('summary:open', { date, focus }),
  // 每日时间块编辑窗口（date 为 'YYYY-MM-DD'）
  openDay: (date) => ipcRenderer.send('day:open', { date })
});
