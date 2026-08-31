const net = require('net');

function createDutyCoordinator({ ipcMain, BrowserWindow, menuApp, port = 47891 }) {
  let menuAppAlive = false;
  let server = null;
  let probeTimer = null;
  function notifyRenderer(value) {
    for (const w of BrowserWindow.getAllWindows()) if (!w.isDestroyed()) w.webContents.send('duties:change', value);
  }
  function startServer() {
    server = net.createServer();
    server.on('error', (error) => console.warn('[study-timer] duty server error:', error.message));
    server.listen(port, '127.0.0.1');
  }
  function startProbe() {
    const probe = () => {
      const socket = net.connect({ port, host: '127.0.0.1' }); socket.setTimeout(800);
      const done = (alive) => { try { socket.destroy(); } catch (e) {} if (alive !== menuAppAlive) { menuAppAlive = alive; notifyRenderer(!alive); } };
      socket.on('connect', () => done(true)); socket.on('error', () => done(false)); socket.on('timeout', () => done(false));
    };
    probe(); probeTimer = setInterval(probe, 30000);
  }
  function get() { return menuApp ? true : !menuAppAlive; }
  function registerIpc() { ipcMain.on('duties:get-sync', (event) => { event.returnValue = get(); }); }
  function stop() { if (probeTimer) clearInterval(probeTimer); if (server) { try { server.close(); } catch (e) {} server = null; } }
  return { startServer, startProbe, get, registerIpc, stop };
}
module.exports = { createDutyCoordinator };
