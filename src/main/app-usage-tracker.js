const { app, powerMonitor } = require('electron');
const { execFile } = require('child_process');
const AUM = require('../renderer/shared/app-usage-model.js').appUsage;

/* ==================== 前台应用使用采集（仅 macOS） ====================
 * 每 5 秒轮询 lsappinfo（系统自带，无需任何授权）拿当前前台应用，
 * 把"人在用电脑的时段里前台是什么应用"按天记入共享 state.json 顶层 appUsage：
 *   { days: { 'YYYY-MM-DD': [{ s, e, b }] }, apps: { bundleId: 显示名 } }
 * s/e 为当天秒。作息归属（学习/短休/大休）不在这里做——渲染端统计页拿当天
 * 时间块动态切分（app-usage-model.aggregate），作息改了历史口径跟着变。
 *
 * 不记录的三种情况（区间就地截断）：
 * - 系统空闲 ≥ 90 秒（息屏/离开；解锁/唤醒后宽限 90 秒强制续记，绕过大 idle 值）
 * - 锁屏 / 系统休眠（powerMonitor 事件即时截断）
 * - 提醒职责不归本 App（duty 互斥：菜单栏端在跑时桌面端不采集，避免双份）
 * 写入走"先写先得"去重（appendSegments），双 App 短暂双跑不会重复计时。 */

function createAppUsageTracker({ sharedState, duty }) {
  if (process.platform !== 'darwin') return { start() {}, stop() {} };

  const POLL_MS = 5000;
  const IDLE_SEC = 90;
  let timer = null;
  let cur = null;              // { bid, name, startTs }
  let probing = false;
  let forceActiveUntil = 0;    // 解锁/唤醒后这段时间无视大 idle 值
  let flagCache = { v: true, at: 0 };

  const pad2 = (n) => String(n).padStart(2, '0');
  const dateStrOf = (ms) => { const d = new Date(ms); return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); };

  /* 开关在共享 state 里（设置页"记录前台应用"），缓存 30 秒避免每 tick 读文件 */
  function enabled() {
    const now = Date.now();
    if (now - flagCache.at < 30000) return flagCache.v;
    let v = true;
    try {
      const all = sharedState.read();
      v = !(all && all.state && all.state.appUsage === false);
    } catch (e) {}
    flagCache = { v, at: now };
    return v;
  }

  /* lsappinfo front 拿 ASN，info 一次取回 bundleId + 显示名 */
  function queryFront(cb) {
    execFile('lsappinfo', ['front'], { timeout: 2000 }, (err, stdout) => {
      const asn = String(stdout || '').trim();
      if (err || !asn) { cb(err || new Error('no front asn')); return; }
      execFile('lsappinfo', ['info', '-only', 'bundleid', '-only', 'name', asn], { timeout: 2000 }, (err2, out) => {
        if (err2) { cb(err2); return; }
        const text = String(out || '');
        const bid = (text.match(/"CFBundleIdentifier"="([^"]*)"/) || [])[1];
        const name = (text.match(/"LSDisplayName"="((?:[^"\\]|\\.)*)"/) || [])[1];
        cb(null, bid ? { bid, name: name ? name.replace(/\\"/g, '"') : bid } : null);
      });
    });
  }

  /* 关闭当前区间并落盘（跨天自动拆段）；不足 2 秒的尾巴直接丢 */
  function close(at) {
    const seg = cur;
    cur = null;
    if (!seg) return;
    let ts = seg.startTs;
    while (ts < at) {
      const d = new Date(ts);
      const day0 = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      const end = Math.min(at, day0 + 86400000);
      const s = Math.round((ts - day0) / 1000), e = Math.round((end - day0) / 1000);
      if (e - s >= 2) writeDay(dateStrOf(day0), [{ s, e, b: seg.bid }], seg);
      ts = end;
    }
  }

  function writeDay(dateStr, segs, seg) {
    try {
      const all = sharedState.read();
      const usage = AUM.normUsage(all.appUsage);
      if (seg && seg.name) usage.apps[seg.bid] = String(seg.name).slice(0, 64);
      AUM.appendSegments(usage.days, dateStr, segs);
      AUM.coalesceSegments(usage.days, dateStr);
      AUM.pruneUsage(usage, dateStrOf(Date.now()));
      all.appUsage = usage;
      sharedState.write(all);
    } catch (e) {
      console.warn('[study-timer] app usage write failed:', e.message);
    }
  }

  function tick() {
    if (!duty.get() || !enabled()) { close(Date.now()); return; }
    const now = Date.now();
    let idle = 0;
    try { idle = powerMonitor.getSystemIdleTime(); } catch (e) {}
    if (idle >= IDLE_SEC && now >= forceActiveUntil) { close(now); return; }
    if (probing) return;
    probing = true;
    queryFront((err, info) => {
      probing = false;
      if (err || !info) return;
      if (cur && cur.bid === info.bid) return;
      close(Date.now());
      cur = { bid: info.bid, name: info.name, startTs: Date.now() };
    });
  }

  function start() {
    if (timer) return;
    // 事件回调里可能还在 spawn 探测：锁屏/休眠先记 forceActive，落下个 tick 收尾也来得及
    powerMonitor.on('lock-screen', () => close(Date.now()));
    powerMonitor.on('suspend', () => close(Date.now()));
    powerMonitor.on('unlock-screen', () => { forceActiveUntil = Date.now() + IDLE_SEC * 1000; });
    powerMonitor.on('resume', () => { forceActiveUntil = Date.now() + IDLE_SEC * 1000; });
    app.on('will-quit', () => { close(Date.now()); });
    timer = setInterval(tick, POLL_MS);
    tick();
  }

  function stop() { if (timer) { clearInterval(timer); timer = null; } }

  return { start, stop };
}

module.exports = { createAppUsageTracker };
