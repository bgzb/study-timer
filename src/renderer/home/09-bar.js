/* ==================== 菜单栏面板模式 ==================== */

// 面板固定尺寸：设置/统计/手记弹层均为 fixed 全覆盖、内部自身滚动，
// 窗口不再随弹层开合撑大缩小，主页与设置页大小始终一致
let barResizeTimer = null;
const BAR_W = 400, BAR_H = 620; // 与 main.js 的 BAR_WIDTH / BAR_HEIGHT 保持一致
function scheduleBarResize() {
  if (!BAR_MODE || !bridge || !bridge.resizeBar) return;
  clearTimeout(barResizeTimer);
  // 抽屉状态可能在这段延迟期间变化，执行时再读取最新状态
  barResizeTimer = setTimeout(() => {
    const extra = (typeof drawerIsOpen === 'function' && drawerIsOpen()) ? drawerExtraWidth() : 0;
    bridge.resizeBar(BAR_W + extra, BAR_H);
  }, 120);
}

function closeSettingsPanel() {
  settingsOverlay.classList.remove('open');
  scheduleBarResize();
}

// 其余窗口改了状态 → 重读 localStorage 并刷新本地视图
function applyStateSync() {
  state = loadState();
  applyI18n();
  rebuildDay();
  tick();
  setQuote(currentState(day));
  if (settingsOverlay.classList.contains('open')) openSettings();
  if (journalOverlay.classList.contains('open') && typeof refreshJournalIfChanged === 'function') refreshJournalIfChanged();
  if (statsOverlay.classList.contains('open') && typeof renderStatsPanel === 'function') renderStatsPanel({ quiet: true });
  if (todoOverlay.classList.contains('open') && typeof refreshTodoIfChanged === 'function') refreshTodoIfChanged();
  if (cdOverlay.classList.contains('open') && typeof refreshCountdownIfChanged === 'function') refreshCountdownIfChanged();
  if (typeof refreshOpenStatsDayLayer === 'function') refreshOpenStatsDayLayer();
  // 外部改动（如保存手记）也可能解锁成就；各窗口都会检测落盘，通知只由职责窗口发
  if (typeof syncAchievements === 'function') syncAchievements();
  scheduleBarResize();
}
if (bridge && bridge.onStateSync) bridge.onStateSync(() => applyStateSync());
// 浏览器开发模式：其它标签页（总结/时间块编辑页）改写 localStorage 时经 storage 事件同步，
// 否则本页 60s 兜底落盘会用内存旧数据覆盖掉刚保存的编辑
if (!bridge) window.addEventListener('storage', (e) => { if (e.key === STORE_KEY) applyStateSync(); });

if (BAR_MODE) {
  // Escape：按层级从上往下收——先弹层，再模式弹层，再侧边抽屉，最后收面板
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (skipReasonOverlay.classList.contains('open')) { closeSkipReason(); return; }
    if (extraOverlay.classList.contains('open')) { closeExtra(); return; }
    if (todoOverlay.classList.contains('open')) { closeTodoPanel(); return; }
    if (cdOverlay.classList.contains('open')) { closeCountdownPanel(); return; }
    if (typeof dismissStatsLayer === 'function' && dismissStatsLayer()) return; // 统计滑入层（日详情/报告）
    if (statsOverlay.classList.contains('open')) { closeStatsPanel(); return; }
    if (settingsOverlay.classList.contains('open')) { closeSettingsPanel(); return; }
    if (journalOverlay.classList.contains('open')) { closeJournalPanel(); return; }
    if (modePopover.style.display === 'block') { modePopover.style.display = 'none'; return; }
    if (typeof closeDrawer === 'function' && closeDrawer()) return;
    if (bridge && bridge.hideBar) bridge.hideBar();
  });
}
