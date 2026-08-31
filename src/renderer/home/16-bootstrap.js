/* ==================== 启动 ==================== */

// 一次性迁移：旧版单 App 的数据在 localStorage 里（桌面端沿用旧 userData 才有），
// 首次启动搬入两 App 共享的 JSON 文件并打标记；菜单栏端/浏览器模式无此路径
(function migrateLocalOnce() {
  if (BAR_MODE || !bridge || !bridge.loadAllSync) return;
  const all = readAll() || {};
  if (all.migratedLocal) return;
  let adopted = null;
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) adopted = JSON.parse(raw);
  } catch (e) {}
  bridge.saveAll({ state: adopted || state, barTheme: all.barTheme || barTheme, migratedLocal: true });
  if (adopted) state = loadState(); // 迁移 adopted 刚写入共享文件，重读回来替换默认值
})();

document.addEventListener('click', () => initAudio(), { once: true });
document.addEventListener('visibilitychange', () => {
  if (document.hidden) return;
  state = loadState(); // 期间其它窗口/标签页可能已改写共享状态（如时间块编辑），先重读再结算
  lastStatsWrite = 0;
  rebuildDay();
  tick();
});

rebuildDay();
applyI18n();
setQuote(currentState(day));
renderPhase(currentState(day));
renderStats();
recordTodayStats(); // 打开应用时立即落一次当天快照（回放今天已进行的进度）
showEnableOverlayIfNeeded();
setInterval(tick, 1000);
tick();
scheduleBarResize();
