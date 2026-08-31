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

function applyBarTheme(theme) {
  const glass = theme === 'glass';
  document.body.classList.toggle('glass', glass);
  barTheme = glass ? 'glass' : 'paper';
  if (bridge && bridge.saveAll) bridge.saveAll({ state, barTheme });
  if (bridge && bridge.setBarVibrancy) bridge.setBarVibrancy(glass);
}

if (BAR_MODE) {
  // 初始 vibrancy 与已存皮肤一致
  if (bridge && bridge.setBarVibrancy) bridge.setBarVibrancy(document.body.classList.contains('glass'));

  // 头部：主题切换按钮（纸质 ↔ 毛玻璃）
  const themeBtn = document.createElement('button');
  themeBtn.id = 'themeBtn';
  themeBtn.textContent = '◧';
  themeBtn.setAttribute('data-i18n-title', 'panelTheme');
  themeBtn.addEventListener('click', () => {
    applyBarTheme(document.body.classList.contains('glass') ? 'paper' : 'glass');
  });
  document.querySelector('header').insertBefore(themeBtn, $('#gearBtn'));

  // 底部：打开主窗口
  const barFooter = document.createElement('div');
  barFooter.id = 'barFooter';
  const openFullBtn = document.createElement('button');
  openFullBtn.setAttribute('data-i18n', 'openFull');
  openFullBtn.addEventListener('click', () => {
    if (bridge) { bridge.launchDesktop(); bridge.hideBar(); }
  });
  barFooter.appendChild(openFullBtn);
  $('#app').appendChild(barFooter);

  // Escape：先收跳过理由/统计/设置弹层，再收面板
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (skipReasonOverlay.classList.contains('open')) { closeSkipReason(); return; }
    if (extraOverlay.classList.contains('open')) { closeExtra(); return; }
    if (statsOverlay.classList.contains('open')) { closeStatsPanel(); return; }
    if (settingsOverlay.classList.contains('open')) { closeSettingsPanel(); return; }
    if (modePopover.style.display === 'block') { modePopover.style.display = 'none'; return; }
    if (bridge && bridge.hideBar) bridge.hideBar();
  });
}
