const { app, BrowserWindow, Tray, Menu, nativeImage, ipcMain, session, shell, screen, Notification } = require('electron');
const { spawn } = require('child_process');
const path = require('path');

let win = null;
let tray = null;
let barWin = null;
let summaryWin = null;
let lastBarHideAt = 0;

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => showWin());

  app.whenReady().then(() => {
    session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => {
      callback(['notifications', 'media', 'fullscreen'].includes(permission));
    });
    createWindow();
    createTray();
    registerNotificationsOnce();
  });

  app.on('window-all-closed', () => {
    // macOS：关窗不退出，驻留菜单栏
  });
  app.on('activate', () => showWin());
  // 关键：任何退出路径（Cmd+Q / Dock退出 / 托盘退出）都会先经过这里，
  // 打开放行标志，否则窗口的 close 拦截会把退出整个吞掉
  app.on('before-quit', () => { app.isQuitting = true; });
  app.on('will-quit', () => { if (tray) { tray.destroy(); tray = null; } });
}

function createWindow() {
  win = new BrowserWindow({
    width: 480,
    height: 780,
    minWidth: 420,
    minHeight: 620,
    show: false,
    backgroundColor: '#faf6f1',
    title: '学习计时',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      backgroundThrottling: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  win.loadFile(path.join(__dirname, 'index.html'));
  // 页面缩放会被 Chromium 持久化，触控板双指捏合容易误触；
  // 每次启动重置为100%，避免 vh/vw 类布局在非100%缩放下溢出
  win.webContents.once('did-finish-load', () => {
    try { win.webContents.setZoomFactor(1); } catch (e) {}
  });

  const launchHidden = process.argv.includes('--hidden');
  win.once('ready-to-show', () => {
    if (!launchHidden) win.show();
  });

  win.on('close', (e) => {
    if (!app.isQuitting) {
      e.preventDefault();
      win.hide();
    }
  });
  win.on('closed', () => { win = null; });
}

function showWin() {
  if (!win || win.isDestroyed()) {
    createWindow();
  } else {
    win.show();
    win.focus();
  }
}

function setAutostart(v) {
  app.setLoginItemSettings({ openAtLogin: !!v, openAsHidden: true });
}

/* ==================== 菜单栏弹出面板 ==================== */

const BAR_WIDTH = 400;
const BAR_HEIGHT = 620;

function createBarWindow() {
  barWin = new BrowserWindow({
    width: BAR_WIDTH,
    height: BAR_HEIGHT,
    show: false,
    frame: false,
    resizable: false,
    skipTaskbar: true,
    transparent: true,
    backgroundColor: '#00000000',
    roundedCorners: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      backgroundThrottling: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  barWin.setAlwaysOnTop(true, 'floating');
  barWin.loadFile(path.join(__dirname, 'index.html'), { search: 'mode=bar' });

  barWin.on('blur', () => {
    // 延迟一拍再收起：若焦点立刻回到窗口（如原生 sheet 弹窗），不打扰
    setTimeout(() => {
      if (barWin && !barWin.isDestroyed() && !barWin.isFocused() && barWin.isVisible()) {
        lastBarHideAt = Date.now();
        barWin.hide();
      }
    }, 60);
  });
  // Cmd+W / 关闭路径同样只隐藏，保持常驻
  barWin.on('close', (e) => {
    if (!app.isQuitting) {
      e.preventDefault();
      lastBarHideAt = Date.now();
      barWin.hide();
    }
  });
  barWin.on('closed', () => { barWin = null; });
}

// 面板水平方向以托盘图标为中心、垂直方向紧贴菜单栏下沿；
// clamp 到托盘所在显示器，防止多屏下跑出屏幕
function positionBarWindow() {
  if (!barWin || barWin.isDestroyed() || !tray) return;
  const tb = tray.getBounds();
  const [w, h] = barWin.getSize();
  const display = screen.getDisplayNearestPoint({ x: Math.round(tb.x + tb.width / 2), y: Math.round(tb.y) });
  const wa = display.workArea;
  let x = Math.round(tb.x + tb.width / 2 - w / 2);
  x = Math.max(wa.x + 4, Math.min(x, wa.x + wa.width - w - 4));
  const y = Math.round(tb.y + tb.height + 6);
  barWin.setPosition(x, y, false);
}

function toggleBarWindow() {
  if (barWin && !barWin.isDestroyed() && barWin.isVisible()) { barWin.hide(); return; }
  // 点面板外触发 blur 刚收起、紧接着的托盘 click 到达：
  // 视为"已经收起"，不重新弹开
  if (Date.now() - lastBarHideAt < 250) return;
  if (!barWin || barWin.isDestroyed()) {
    createBarWindow();
    // 首次创建等页面就绪再显示，避免闪一个空窗口
    barWin.once('ready-to-show', () => {
      positionBarWindow();
      barWin.show();
      barWin.focus();
    });
  } else {
    positionBarWindow();
    barWin.show();
    barWin.focus();
  }
}

function createTray(attempt) {
  attempt = attempt || 0;
  const icon = nativeImage.createFromPath(path.join(__dirname, 'assets', 'trayTemplate.png'));
  icon.setTemplateImage(true);
  tray = new Tray(icon);
  tray.setTitle('--:--');
  tray.setToolTip('学习计时 Study Timer');
  console.log('[study-timer] tray created, iconEmpty=' + icon.isEmpty());

  const popupMenu = () => {
    const visible = win && win.isVisible();
    const menu = Menu.buildFromTemplate([
      { label: '显示面板 Show Panel', click: () => toggleBarWindow() },
      { label: visible ? '隐藏主窗口 Hide Window' : '显示主窗口 Show Window', click: () => { visible ? win.hide() : showWin(); } },
      { label: '重启应用 Restart', click: () => { app.isQuitting = true; app.relaunch(); app.quit(); } },
      { type: 'separator' },
      {
        label: '开机自启 Launch at Login',
        type: 'checkbox',
        checked: app.getLoginItemSettings().openAtLogin,
        click: (mi) => setAutostart(mi.checked)
      },
      { type: 'separator' },
      { label: '退出 Quit', click: () => { app.isQuitting = true; app.quit(); } }
    ]);
    tray.popUpContextMenu(menu);
  };
  tray.on('click', toggleBarWindow);
  tray.on('right-click', popupMenu);

  // macOS 偶发不渲染新状态项（应用被替换安装、菜单栏过挤/刘海遮挡时）：
  // 创建后探测 bounds，全零说明系统没有显示这个图标，自动重建重试
  if (attempt < 3) {
    setTimeout(() => {
      if (!tray || tray.isDestroyed()) return;
      const b = tray.getBounds();
      if (b.width > 0 && b.height > 0) return;
      console.log('[study-timer] tray item not shown (bounds=' + JSON.stringify(b) + '), recreating #' + (attempt + 1));
      try { tray.destroy(); } catch (e) {}
      tray = null;
      createTray(attempt + 1);
    }, 2500);
  }
}

/* ==================== 每日总结窗口 ==================== */

function validDateStr(s) { return /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')); }
function todayDateStr() {
  const d = new Date();
  const p = (n) => (n < 10 ? '0' : '') + n;
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}

// focus=true：从手记面板手动打开，正常前置；
// focus=false：全天结束自动弹出，showInactive 柔和出现、不抢键盘焦点
function openSummaryWindow(date, focus) {
  const ds = validDateStr(date) ? date : todayDateStr();
  if (summaryWin && !summaryWin.isDestroyed()) {
    const cur = (summaryWin.webContents.getURL().match(/date=(\d{4}-\d{2}-\d{2})/) || [])[1];
    if (cur !== ds) summaryWin.loadFile(path.join(__dirname, 'summary.html'), { search: 'date=' + ds });
    if (focus) { summaryWin.show(); summaryWin.focus(); } else summaryWin.showInactive();
    return;
  }
  summaryWin = new BrowserWindow({
    width: 460,
    height: 720,
    minWidth: 420,
    minHeight: 560,
    show: false,
    center: true,
    backgroundColor: '#faf6f1',
    title: '每日总结',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      backgroundThrottling: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  summaryWin.loadFile(path.join(__dirname, 'summary.html'), { search: 'date=' + ds });
  summaryWin.once('ready-to-show', () => {
    if (focus) { summaryWin.show(); summaryWin.focus(); } else summaryWin.showInactive();
  });
  // 总结窗是临时表单：关闭即销毁，不做驻留拦截
  summaryWin.on('closed', () => { summaryWin = null; });
}

ipcMain.on('summary:open', (_e, p) => openSummaryWindow(p && p.date, !!(p && p.focus)));

ipcMain.on('tray:update', (_e, payload) => {
  if (tray && payload && payload.title != null) {
    tray.setTitle(String(payload.title));
    if (payload.tooltip) tray.setToolTip(String(payload.tooltip));
  }
});
ipcMain.on('win:show', () => showWin());
ipcMain.on('autostart:set', (_e, v) => setAutostart(v));
ipcMain.handle('autostart:get', () => app.getLoginItemSettings().openAtLogin);
ipcMain.on('app:restart', () => {
  app.isQuitting = true;
  app.relaunch();
  app.quit();
});
// 系统级提示音：afplay 播放 macOS 自带音效，比页面内合成音响亮可靠
ipcMain.on('sound:play', (_e, payload) => {
  const file = payload && payload.file;
  if (!file) return;
  // 渲染端传的是系统音名（如 Glass），afplay 需要带扩展名的完整文件名
  const name = /\.\w+$/.test(file) ? file : file + '.aiff';
  const args = [path.join('/System/Library/Sounds', name)];
  const vol = payload.volume;
  if (typeof vol === 'number' && vol !== 1) args.push('-v', String(Math.max(0.1, Math.min(2.5, vol))));
  try {
    const p = spawn('afplay', args, { stdio: 'ignore' });
    p.on('error', (err) => console.warn('afplay failed:', err.message));
  } catch (e) { console.warn('afplay spawn error:', e.message); }
});
ipcMain.on('sysprefs:notifications', () => {
  shell.openExternal('x-apple.systempreferences:com.apple.preference.notifications').catch(() => {});
});
// 通知统一走主进程原生通道：渲染进程的 HTML5 Notification 在临时签名的打包 App 上
// 可能静默失败（系统设置里也不会注册），主进程 Notification 会触发系统授权并注册。
// 提示音直接挂在通知上（sound=系统音名），由系统随横幅一起播放，最可靠。
ipcMain.on('notify', (_e, p) => {
  if (p) showNotification(p.title, p.body, p.sound);
});

function showNotification(title, body, sound) {
  try {
    if (Notification.isSupported()) {
      const opts = { title: String(title || ''), body: String(body || ''), silent: !sound };
      if (sound) opts.sound = String(sound);
      const n = new Notification(opts);
      n.on('click', () => showWin());
      n.show();
      return;
    }
  } catch (e) {}
  try {
    const esc = (s) => String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    const snd = sound ? ` sound name "${esc(sound)}"` : ' sound name "Glass"';
    spawn('osascript', ['-e', `display notification "${esc(body)}" with title "${esc(title)}"${snd}`], { stdio: 'ignore' }).on('error', () => {});
  } catch (e) {}
}

// 首次启动主动发一条注册通知：让应用出现在 系统设置→通知 列表里并触发授权弹窗（只做一次）
function registerNotificationsOnce() {
  const fs = require('fs');
  const flag = path.join(app.getPath('userData'), 'notif-registered');
  try {
    if (fs.existsSync(flag)) return;
    fs.writeFileSync(flag, '1');
    setTimeout(() => showNotification('学习计时 Study Timer', '提醒已就绪：到点会自动提示学习与休息。'), 2000);
  } catch (e) {}
}

/* 双窗口状态同步：任一渲染进程改了 localStorage，转发给其余窗口 */
ipcMain.on('state:changed', (e) => {
  for (const w of BrowserWindow.getAllWindows()) {
    if (w.isDestroyed() || w.webContents === e.sender) continue;
    w.webContents.send('state:sync');
  }
});

ipcMain.on('bar:hide', () => {
  if (barWin && !barWin.isDestroyed()) {
    lastBarHideAt = Date.now();
    barWin.hide();
  }
});
ipcMain.on('bar:resize', (_e, payload) => {
  if (!barWin || barWin.isDestroyed() || !payload) return;
  const w = Math.min(Math.max(parseInt(payload.w, 10) || BAR_WIDTH, 320), 480);
  let h = Math.min(Math.max(parseInt(payload.h, 10) || 560, 320), 800);
  // 高度不超过托盘所在显示器工作区（预留菜单栏与边距），避免面板顶出屏幕
  if (tray) {
    const tb = tray.getBounds();
    const wa = screen.getDisplayNearestPoint({ x: Math.round(tb.x), y: Math.round(tb.y) }).workArea;
    h = Math.min(h, wa.height - 24);
  }
  barWin.setSize(w, h, false);
  positionBarWindow();
});
ipcMain.on('bar:vibrancy', (_e, on) => {
  if (barWin && !barWin.isDestroyed()) {
    try { barWin.setVibrancy(on ? 'under-window' : null); } catch (e) {}
  }
});
