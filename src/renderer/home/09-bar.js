/* ==================== 菜单栏面板模式 ==================== */

// 面板固定尺寸：设置/统计/手记弹层均为 fixed 全覆盖、内部自身滚动，
// 窗口不再随弹层开合撑大缩小，主页与设置页大小始终一致
let barResizeTimer = null;
const BAR_W = 400, BAR_H = 620; // 与 main.js 的 BAR_WIDTH / BAR_HEIGHT 保持一致
function scheduleBarResize() {
  if (!BAR_MODE || !bridge || !bridge.resizeBar) return;
  clearTimeout(barResizeTimer);
  barResizeTimer = setTimeout(() => bridge.resizeBar(BAR_W, BAR_H), 120);
}

function closeSettingsPanel() {
  settingsOverlay.classList.remove('open');
  scheduleBarResize();
}

// 其余窗口改了状态 → 重读 localStorage 并刷新本地视图
function applyStateSync() {
  state = loadState();
  syncPanelTheme();
  applyI18n();
  rebuildDay();
  tick();
  setQuote(currentState(day));
  if (settingsOverlay.classList.contains('open')) openSettings();
  if (journalOverlay.classList.contains('open')) renderJournalPanel();
  scheduleBarResize();
}
if (bridge && bridge.onStateSync) bridge.onStateSync(() => applyStateSync());
// 浏览器开发模式：其它标签页（总结/时间块编辑页）改写 localStorage 时经 storage 事件同步，
// 否则本页 60s 兜底落盘会用内存旧数据覆盖掉刚保存的编辑
if (!bridge) window.addEventListener('storage', (e) => { if (e.key === STORE_KEY) applyStateSync(); });

function applyBarTheme(theme, persist) {
  barTheme = StudyTimerShared.normalizePanelTheme(theme);
  const glass = barTheme === 'glass';
  if (BAR_MODE) {
    document.body.classList.toggle('glass', glass);
    if (bridge && bridge.setBarVibrancy) bridge.setBarVibrancy(glass);
  }
  const themeBtn = $('#themeBtn');
  if (themeBtn) themeBtn.setAttribute('aria-pressed', String(glass));
  if (persist) saveState();
}

function syncPanelTheme() {
  const all = readAll();
  let stored = all && all.barTheme;
  if (!all) {
    try { stored = localStorage.getItem(BAR_THEME_KEY); } catch (e) {}
  }
  applyBarTheme(stored || barTheme, false);
}

const themeBtn = $('#themeBtn');
if (themeBtn) {
  themeBtn.addEventListener('click', () => {
    applyBarTheme(StudyTimerShared.nextPanelTheme(barTheme), true);
  });
}
syncPanelTheme();

if (BAR_MODE) {
  // 初始 vibrancy 与已存皮肤一致
  if (bridge && bridge.setBarVibrancy) bridge.setBarVibrancy(document.body.classList.contains('glass'));

  // Escape：先收扩展面板/跳过理由/统计/设置弹层，再收面板
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (typeof closeExtBar === 'function' && closeExtBar()) return;
    if (skipReasonOverlay.classList.contains('open')) { closeSkipReason(); return; }
    if (extraOverlay.classList.contains('open')) { closeExtra(); return; }
    if (statsOverlay.classList.contains('open')) { closeStatsPanel(); return; }
    if (settingsOverlay.classList.contains('open')) { closeSettingsPanel(); return; }
    if (modePopover.style.display === 'block') { modePopover.style.display = 'none'; return; }
    if (bridge && bridge.hideBar) bridge.hideBar();
  });
}
