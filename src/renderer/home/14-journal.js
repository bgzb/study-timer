/* ==================== 总结手记面板 ==================== */

const journalOverlay = $('#journalOverlay');
let journalView = 'list'; // 'list' 或详情日期 'YYYY-MM-DD'
let jMonthFold = {};      // 用户手动开合的月份覆盖（会话内有效）：'YYYY-MM' -> true 折叠 / false 展开
let journalSig = null;    // 上次渲染的手记内容签名：state 同步时对比，内容没变不重绘
const JOURNAL_MOODS = ['mood0', 'mood1', 'mood2', 'mood3', 'mood4'];

function ratingIcons(value, size) {
  if (!value || !iconSvg) return '';
  return '<span class="stars" aria-label="' + value + '/5">'
    + Array.from({ length: Math.min(5, value) }, () => iconSvg('star', { size: size || 12 })).join('')
    + '</span>';
}

function escHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function journalDateLabel(str) {
  const d = parseDateStr(str);
  const zh = state.language !== 'en';
  const day = zh ? (d.getMonth() + 1) + '月' + d.getDate() + '日'
    : MONTH_EN[d.getMonth()].slice(0, 3) + ' ' + d.getDate();
  const yr = d.getFullYear() !== today.y ? (d.getFullYear() + (zh ? '年' : ' ')) : '';
  const wd = zh ? '星期' + WEEK_ZH[d.getDay()] : WEEK_EN[d.getDay()];
  return yr + day + ' · ' + wd;
}

function journalMonthLabel(ym) {
  const y = Number(ym.slice(0, 4)), m = Number(ym.slice(5, 7));
  return state.language === 'en' ? MONTH_EN[m - 1] + ' ' + y : y + '年' + m + '月';
}

function journalRowHtml(k, e) {
  const min = dayStatOf(k) ? dayStatOf(k).focusMin : 0;
  const stars = ratingIcons(e.rating, 12);
  const head = e.headline ? '<div class="jHead">' + escHtml(e.headline) + '</div>' : '';
  const tags = (e.tags && e.tags.length)
    ? '<div class="jTags">' + e.tags.map((x) => '<span class="jTag">' + escHtml(x) + '</span>').join('') + '</div>' : '';
  return '<div class="jRow" data-date="' + k + '">'
    + '<span class="jEmoji">' + (e.mood >= 0 && e.mood < JOURNAL_MOODS.length ? iconSvg(JOURNAL_MOODS[e.mood], { size: 22 }) : iconSvg('journal', { size: 22 })) + '</span>'
    + '<div class="jMain"><div class="jDate">' + journalDateLabel(k) + stars + '</div>' + head + tags + '</div>'
    + '<span class="jMin">' + fmtMinShort(min) + '</span>'
    + '</div>';
}

/* 手记按月分组：月份标题吸顶，当前月与上个月默认展开，更早的折叠成一行（点击展开），
   几百篇手记也不会被无限长的单列淹没 */
function journalListView() {
  const j = state.journal || {};
  const keys = Object.keys(j).filter((k) => j[k]).sort().reverse();
  let html = '';
  if (!j[today.str]) {
    html += '<div class="jTodayCard"><span>' + t('journalTodayCard') + '</span>'
      + '<button id="jTodayBtn">' + iconText('journal', t('journalFillToday')) + '</button></div>';
  }
  if (!keys.length) return html + '<div class="jEmpty">' + t('journalEmpty') + '</div>';
  const groups = [];
  for (const k of keys) {
    const ym = k.slice(0, 7);
    if (!groups.length || groups[groups.length - 1].ym !== ym) groups.push({ ym, keys: [] });
    groups[groups.length - 1].keys.push(k);
  }
  for (let gi = 0; gi < groups.length; gi++) {
    const g = groups[gi];
    const fold = g.ym in jMonthFold ? jMonthFold[g.ym] : gi >= 2;
    html += '<div class="jMonthHead' + (fold ? ' folded' : '') + '" data-ym="' + g.ym + '" role="button" tabindex="0" aria-expanded="' + (!fold) + '">'
      + '<span class="nm">' + journalMonthLabel(g.ym) + '</span>'
      + '<span class="cnt">' + tf('jMonthCnt', g.keys.length) + '</span>'
      + '<i class="chev">' + iconSvg('back', { size: 12 }) + '</i></div>';
    if (!fold) for (const k of g.keys) html += journalRowHtml(k, j[k]);
  }
  return html;
}

/* 打开某日的「时间块」编辑窗口（day.html）；浏览器开发模式回落为新标签页打开 */
function openDayEditor(dateStr) {
  const ds = dateStr || today.str;
  if (bridge && bridge.openDay) bridge.openDay(ds);
  else window.open('day.html?date=' + ds, '_blank');
}

/* 跳过记录：直接读 skips 事件日志（含理由与块快照），今日日志之外的两个归档视图共用 */
function skipLogHtml(dateStr) {
  const list = ((state.skips || {})[dateStr] || []).filter((x) => x && x.key);
  if (!list.length) return '';
  let rows = '';
  for (const x of list) {
    const type = x.type
      ? '<span class="skType ' + (x.type === 'break' ? 'brk' : 'sty') + '">' + t(x.type === 'break' ? 'breakWord' : 'studyWord') + '</span>'
      : '';
    const range = x.start != null && x.end != null
      ? fmtClock(x.start) + ' – ' + fmtClock(x.end)
      : (x.at != null ? t('skipAtTime')(fmtClock(x.at)) : '');
    rows += '<div class="skipRow">' + type
      + '<span class="t">' + range + '</span>'
      + '<span class="r">' + (x.reason ? escHtml(x.reason) : t('skipNoReason')) + '</span>'
      + '</div>';
  }
  return '<div class="jSection"><div class="k">' + t('skipLogTitle') + '</div>' + rows + '</div>';
}

function journalDetailView(dateStr) {
  const e = (state.journal || {})[dateStr];
  if (!e) return journalListView();
  const st = dayStatOf(dateStr);
  let html = '<button class="jBackBtn" id="jBackBtn">' + iconText('back', t('jBack')) + '</button>';
  html += '<div class="jDetailHead">'
    + '<div class="jEmojiBig">' + (e.mood >= 0 && e.mood < JOURNAL_MOODS.length ? iconSvg(JOURNAL_MOODS[e.mood], { size: 32 }) : iconSvg('journal', { size: 32 })) + '</div>'
    + '<div class="jd">' + journalDateLabel(dateStr) + '</div>'
    + (e.rating > 0 ? ratingIcons(e.rating, 14) : '')
    + '</div>';
  if (st) {
    html += '<div class="stSummary">'
      + stCell(fmtMinShort(st.focusMin), t('statTotal'))
      + stCell(st.done + '/' + st.total, t('statDoneBlocks'))
      + stCell(st.skipped, t('statSkipped'))
      + '</div>';
  } else {
    html += '<div class="jEmpty">' + t('jNoStats') + '</div>';
  }
  html += skipLogHtml(dateStr);
  if (e.headline) html += '<div class="jHeadline">' + escHtml(e.headline) + '</div>';
  if (e.tags && e.tags.length) {
    html += '<div class="jSection"><div class="k">' + t('jTags') + '</div><div class="jTags">'
      + e.tags.map((x) => '<span class="jTag">' + escHtml(x) + '</span>').join('') + '</div></div>';
  }
  const secs = [['good', t('jGood')], ['improve', t('jImprove')], ['plan', t('jPlan')]];
  for (const sec of secs) {
    if (e[sec[0]]) html += '<div class="jSection"><div class="k">' + sec[1] + '</div><div class="v">' + escHtml(e[sec[0]]) + '</div></div>';
  }
  const fmtTime = (iso) => {
    const d = new Date(iso);
    return isNaN(d.getTime()) ? '' : pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  };
  html += '<div class="jFoot"><span class="time">' + t('jSavedAt') + ' ' + fmtTime(e.savedAt)
    + (e.editedAt ? ' · ' + t('jEditedAt') + ' ' + fmtTime(e.editedAt) : '') + '</span>'
    + '<button class="jEditBtn" id="jDayBtn" data-date="' + dateStr + '">' + iconText('time', t('jDayBtn')) + '</button>'
    + '<button class="jEditBtn" id="jEditBtn" data-date="' + dateStr + '">' + iconText('edit', t('jEdit')) + '</button></div>';
  return html;
}

function renderJournalPanel(opts) {
  if (!journalOverlay.classList.contains('open')) return;
  const body = $('#journalBody');
  const keep = !!(opts && opts.keepScroll);
  const st = keep ? body.scrollTop : 0;
  body.innerHTML = journalView === 'list' ? journalListView() : journalDetailView(journalView);
  body.scrollTop = st;
  journalSig = JSON.stringify(state.journal || {});
}

/* 状态同步时：手记内容真的变了才重绘（每分钟兜底落盘触发的 sync 不重绘、不丢滚动位置） */
function refreshJournalIfChanged() {
  if (!journalOverlay.classList.contains('open')) { journalSig = null; return; }
  const sig = JSON.stringify(state.journal || {});
  if (sig === journalSig) return;
  renderJournalPanel({ keepScroll: true });
}

function openJournalPanel(dateStr) {
  journalView = dateStr || 'list';
  journalOverlay.classList.add('open');
  renderJournalPanel();
  scheduleBarResize();
}
function closeJournalPanel() {
  journalOverlay.classList.remove('open');
  scheduleBarResize();
}

// 打开入口在侧边抽屉（17-tool-drawer.js 的 DRAWER_ACTIONS.journal）
$('#closeJournal').addEventListener('click', closeJournalPanel);
journalOverlay.addEventListener('click', (e) => { if (e.target === journalOverlay) closeJournalPanel(); });
$('#journalBody').addEventListener('click', (e) => {
  if (e.target.closest('#jTodayBtn')) {
    if (bridge && bridge.openSummary) bridge.openSummary(today.str, true);
    return;
  }
  const editBtn = e.target.closest('#jEditBtn');
  if (editBtn) {
    if (bridge && bridge.openSummary) bridge.openSummary(editBtn.dataset.date, true);
    return;
  }
  const dayBtn = e.target.closest('#jDayBtn');
  if (dayBtn) {
    openDayEditor(dayBtn.dataset.date);
    return;
  }
  if (e.target.closest('#jBackBtn')) { openJournalPanel(); return; }
  const monthHead = e.target.closest('.jMonthHead');
  if (monthHead && monthHead.dataset.ym) {
    // 展开状态点击 → 折叠；折叠状态点击 → 展开（覆盖默认值，会话内记住）
    jMonthFold[monthHead.dataset.ym] = !monthHead.classList.contains('folded');
    renderJournalPanel({ keepScroll: true });
    return;
  }
  const row = e.target.closest('.jRow');
  if (row && row.dataset.date) openJournalPanel(row.dataset.date);
});
