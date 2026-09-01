/* ==================== 运行模式 ==================== */
/* ?mode=bar：菜单栏端弹出面板（紧凑布局）。
 * 提醒/统计等副作用由"职责窗口"触发（菜单栏端常驻负责；桌面端在菜单栏端
 * 未运行时临时接管），bar 面板始终纯展示，避免双份 */
const BAR_MODE = new URLSearchParams(location.search).get('mode') === 'bar';
const BAR_THEME_KEY = 'studyTimer.barTheme';
const iconApi = window.StudyTimerIcons || {};
const iconSvg = iconApi.iconSvg;
const iconText = iconApi.iconText;
function renderIconSlots(scope) {
  if (!iconSvg) return;
  (scope || document).querySelectorAll('span[data-icon]').forEach((slot) => {
    if (slot.childElementCount) return;
    slot.innerHTML = iconSvg(slot.dataset.icon, { size: slot.dataset.iconSize || 18 });
  });
}
function setIconLabel(el, name, text) {
  if (el && iconText) el.innerHTML = iconText(name, text);
}

// 跨 App 共享状态：Electron 下走主进程的共享 JSON 文件（两个 App 经它同步），
// 浏览器模式回落 localStorage
function readAll() {
  if (window.studyTimer && window.studyTimer.loadAllSync) {
    try { return window.studyTimer.loadAllSync() || {}; } catch (e) { return {}; }
  }
  return null;
}
let barTheme = 'paper';
if (BAR_MODE) {
  document.body.classList.add('bar');
  const all0 = readAll();
  if (all0) barTheme = all0.barTheme || 'paper';
  else { try { barTheme = localStorage.getItem(BAR_THEME_KEY) || 'paper'; } catch (e) {} }
  if (barTheme === 'glass') document.body.classList.add('glass');
}

function t(key) {
  const lang = state.language === 'en' ? 'en' : 'zh';
  const d = I18N[lang] || I18N.zh;
  const v = d[key] != null ? d[key] : I18N.zh[key];
  return v != null ? v : key;
}

const WEEK_ZH = ['日', '一', '二', '三', '四', '五', '六'];
const WEEK_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTH_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function applyI18n() {
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const v = t(el.dataset.i18n);
    if (typeof v === 'string') el.textContent = v;
  });
  document.querySelectorAll('[data-i18n-html]').forEach((el) => {
    const v = t(el.dataset.i18nHtml);
    if (typeof v === 'string') el.innerHTML = v;
  });
  document.querySelectorAll('[data-i18n-ph]').forEach((el) => {
    const v = t(el.dataset.i18nPh);
    if (typeof v === 'string') el.placeholder = v;
  });
  document.querySelectorAll('[data-i18n-title]').forEach((el) => {
    const v = t(el.dataset.i18nTitle);
    if (typeof v === 'string') el.title = v;
  });
  document.title = t('appName');
  const seg = $('#langSeg');
  if (seg) seg.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b.dataset.lang === (state.language === 'en' ? 'en' : 'zh')));
  renderIconSlots(document);
}

const QUOTE_CATEGORIES = [
  { id: 'morningFirst', label: '上午首块' },
  { id: 'afternoonFirst', label: '下午首块' },
  { id: 'eveningFirst', label: '晚上首块' },
  { id: 'study', label: '学习块' },
  { id: 'break', label: '休息块' },
  { id: 'extraStart', label: '加钟开始' },
  { id: 'extraEnd', label: '加钟完成' },
  { id: 'sessionEnd', label: '时段结束' },
  { id: 'dayDone', label: '全天完成' }
];

const SOUND_PRESETS = {
  chime: { label: '清脆铃音', sys: 'Glass', notes: [{ f: 1318.5, t: 0, d: 0.14 }, { f: 1760, t: 0.1, d: 0.24 }] },
  soft: { label: '柔和提示', sys: 'Pop', notes: [{ f: 784, t: 0, d: 0.5, g: 0.6 }] },
  bell: { label: '悠扬钟声', sys: 'Hero', notes: [{ f: 880, t: 0, d: 1.1, type: 'triangle' }, { f: 1318.5, t: 0.02, d: 0.9, g: 0.3 }] },
  alert: { label: '活泼三连', sys: 'Funk', notes: [{ f: 1046.5, t: 0, d: 0.1 }, { f: 1318.5, t: 0.1, d: 0.1 }, { f: 1568, t: 0.2, d: 0.16 }] }
};
