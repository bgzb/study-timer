/* ==================== 侧边工具抽屉 ==================== */
/* 贴右缘常驻图标轨 + 可展开抽屉。条目来自共享注册表（shared/tool-registry.js），
   新增功能只需在注册表加一行；这里负责渲染、开合交互与动作分发。
   开合只由顶部箭头按钮控制（Escape/点击主内容也可收起）；点功能条目一律不动抽屉，
   窗口尺寸变化只发生在明确的展开/收起动作上。
   展开时窗口向右加宽（drawer:size，左缘固定、主页不动），收起时恢复原宽；
   浏览器开发模式无法改窗口宽，退化为把主页内容挤窄，同样不遮挡。 */
const toolDrawer = $('#toolDrawer');
const drawerToggle = $('#drawerToggle');

/* 轨道/展开宽度以 home.css 的 --td-rail / --td-open 为唯一来源（body.bar 有紧凑覆盖），
   读取失败时回落到与 CSS 一致的字面量 */
function drawerSizeVar(name, fallback) {
  const v = parseFloat(getComputedStyle(document.body).getPropertyValue(name));
  return v > 0 ? v : fallback;
}
const DRAWER_RAIL = drawerSizeVar('--td-rail', BAR_MODE ? 44 : 52);
const DRAWER_OPEN = drawerSizeVar('--td-open', BAR_MODE ? 176 : 180);
function drawerExtraWidth() { return DRAWER_OPEN - DRAWER_RAIL; }

/* 展开目标宽度基于"收起态窗口宽"计算：展开动画进行中 innerWidth 是过渡值，不可直接用 */
let drawerBaseWidth = Math.round(window.innerWidth);
let drawerBaseTimer = null;
window.addEventListener('resize', () => {
  if (drawerIsOpen()) return;
  clearTimeout(drawerBaseTimer);
  drawerBaseTimer = setTimeout(() => {
    if (!drawerIsOpen()) drawerBaseWidth = Math.round(window.innerWidth);
  }, 350);
});

function renderDrawer() {
  const scroll = $('#drawerScroll');
  scroll.innerHTML = '';
  StudyTimerShared.TOOL_GROUPS.forEach((group, gi) => {
    if (gi > 0) {
      const spacer = document.createElement('div');
      spacer.className = 'td-spacer';
      scroll.appendChild(spacer);
    }
    const box = document.createElement('div');
    box.className = 'td-group';
    const title = document.createElement('div');
    title.className = 'td-group-title';
    title.dataset.i18n = group.titleKey;
    box.appendChild(title);
    group.tools.forEach((tool) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'td-item';
      btn.dataset.tool = tool.id;
      btn.dataset.i18nTitle = tool.titleKey || tool.labelKey;
      if (tool.kind === 'toggle') btn.setAttribute('aria-pressed', 'false');
      const ico = document.createElement('span');
      ico.className = 'td-ico';
      ico.dataset.icon = tool.icon;
      const label = document.createElement('span');
      label.className = 'td-label';
      label.dataset.i18n = tool.labelKey;
      btn.appendChild(ico);
      btn.appendChild(label);
      box.appendChild(btn);
    });
    scroll.appendChild(box);
  });
  // 填充文案/标题并水合图标（含语言切换后由 applyStateSync 重跑的场景）
  applyI18n();
}

/* 各条目动作：与注册表 id 一一对应，新功能在这里补一个分支即可 */
const DRAWER_ACTIONS = {
  journal: () => openJournalPanel(),
  stats: () => openStats(),
  theme: () => applyBarTheme(StudyTimerShared.nextPanelTheme(barTheme), true),
  settings: () => openSettings()
};

function drawerIsOpen() { return document.body.classList.contains('drawer-open'); }
function openDrawer() {
  if (drawerIsOpen()) return;
  document.body.classList.add('drawer-open');
  drawerToggle.setAttribute('aria-expanded', 'true');
  if (bridge && bridge.setDrawerWidth) bridge.setDrawerWidth(drawerBaseWidth + drawerExtraWidth());
}
function closeDrawer() {
  if (!drawerIsOpen()) return false;
  document.body.classList.remove('drawer-open');
  drawerToggle.setAttribute('aria-expanded', 'false');
  if (bridge && bridge.setDrawerWidth) bridge.setDrawerWidth(null);
  return true;
}

/* 开合只由箭头按钮控制：悬停不展开，避免鼠标扫过时窗口意外伸缩 */
drawerToggle.addEventListener('click', (e) => {
  e.stopPropagation();
  if (drawerIsOpen()) closeDrawer(); else openDrawer();
});
// 抽屉外任意点击收起（展开后主页可正常交互，点一下主页即收回）
document.addEventListener('click', (e) => {
  if (drawerIsOpen() && !toolDrawer.contains(e.target)) closeDrawer();
});
// 点条目只执行动作，抽屉保持原状：弹层（z-90+）盖在抽屉之上，窗口尺寸不变
$('#drawerScroll').addEventListener('click', (e) => {
  const btn = e.target.closest('.td-item');
  if (!btn) return;
  const action = DRAWER_ACTIONS[btn.dataset.tool];
  if (action) action();
});

renderDrawer();
// 09-bar.js 的 syncPanelTheme 先于本文件执行时抽屉条目尚未渲染，这里补一次开关态同步
syncPanelTheme();
