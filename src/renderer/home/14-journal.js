/* ==================== 总结手记面板 ==================== */

const journalOverlay = $('#journalOverlay');
let journalView = 'list'; // 'list' 或详情日期 'YYYY-MM-DD'
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

function journalListView() {
  const j = state.journal || {};
  const keys = Object.keys(j).filter((k) => j[k]).sort().reverse();
  let html = '';
  if (!j[today.str]) {
    html += '<div class="jTodayCard"><span>' + t('journalTodayCard') + '</span>'
      + '<button id="jTodayBtn">' + iconText('journal', t('journalFillToday')) + '</button></div>';
  }
  if (!keys.length) return html + '<div class="jEmpty">' + t('journalEmpty') + '</div>';
  for (const k of keys) {
    const e = j[k];
    const min = dayStatOf(k) ? dayStatOf(k).focusMin : 0;
    const stars = ratingIcons(e.rating, 12);
    const head = e.headline ? '<div class="jHead">' + escHtml(e.headline) + '</div>' : '';
    const tags = (e.tags && e.tags.length)
      ? '<div class="jTags">' + e.tags.map((x) => '<span class="jTag">' + escHtml(x) + '</span>').join('') + '</div>' : '';
    html += '<div class="jRow" data-date="' + k + '">'
      + '<span class="jEmoji">' + (e.mood >= 0 && e.mood < JOURNAL_MOODS.length ? iconSvg(JOURNAL_MOODS[e.mood], { size: 22 }) : iconSvg('journal', { size: 22 })) + '</span>'
      + '<div class="jMain"><div class="jDate">' + journalDateLabel(k) + stars + '</div>' + head + tags + '</div>'
      + '<span class="jMin">' + fmtMin(min) + '</span>'
      + '</div>';
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
      + stCell(fmtMin(st.focusMin), t('statTotal'))
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

function renderJournalPanel() {
  if (!journalOverlay.classList.contains('open')) return;
  $('#journalBody').innerHTML = journalView === 'list' ? journalListView() : journalDetailView(journalView);
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

$('#journalBtn').addEventListener('click', () => { openJournalPanel(); });
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
  const row = e.target.closest('.jRow');
  if (row && row.dataset.date) openJournalPanel(row.dataset.date);
});
