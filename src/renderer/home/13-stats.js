/* ==================== 学习统计面板 ==================== */

const statsOverlay = $('#statsOverlay');
let statsRange = 'today';
let lastPanelFocus = -1;

function statDateStr(d) {
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
}
function parseDateStr(str) {
  const p = str.split('-').map(Number);
  return new Date(p[0], p[1] - 1, p[2]);
}
function addDaysStr(str, delta) {
  const p = str.split('-').map(Number);
  return statDateStr(new Date(p[0], p[1] - 1, p[2] + delta));
}
function fmtMin(min) {
  min = Math.round(min);
  const h = Math.floor(min / 60), m = min % 60;
  return h > 0 ? t('durH')(h, m) : t('durM')(m);
}
function stCell(v, k) {
  return '<div class="cell"><div class="v">' + v + '</div><div class="k">' + k + '</div></div>';
}
function dayStatOf(str) {
  return (state.dailyStats || {})[str] || null;
}
function calcStreak() {
  const has = (d) => { const s = dayStatOf(d); return s && s.focusMin > 0; };
  let d = today.str;
  if (!has(d)) d = addDaysStr(d, -1); // 今天还没开始学不打断连续记录
  let cur = 0;
  while (has(d)) { cur++; d = addDaysStr(d, -1); }
  const dates = Object.keys(state.dailyStats || {}).filter(has).sort();
  let best = 0, run = 0, prev = null;
  for (const k of dates) {
    run = (prev && addDaysStr(prev, 1) === k) ? run + 1 : 1;
    if (run > best) best = run;
    prev = k;
  }
  return { cur, best };
}

function renderTodayView() {
  const st = dayStatOf(today.str);
  const focus = st ? st.focusMin : 0;
  const done = st ? st.done : 0, total = st ? st.total : 0;
  const rate = total > 0 ? Math.round((done / total) * 100) : 0;
  let html = '<div class="stBig"><div class="v">' + fmtMin(focus) + '</div><div class="k">' + t('todayFocus') + '</div></div>';
  html += '<div class="stSummary">'
    + stCell(done + '/' + total, t('statDoneBlocks'))
    + stCell(st ? st.skipped : 0, t('statSkipped'))
    + stCell(rate + '%', t('statRate'))
    + '</div>';
  const logs = (st && st.blocks) || [];
  if (!logs.length) return html + '<div class="stEmpty">' + t('statsEmpty') + '</div>';
  html += '<div class="stLogTitle">' + t('todayLogTitle')
    + '<button id="stEditDayBtn">' + iconText('edit', t('editDayBtn')) + '</button></div><div class="stLog">';
  for (const b of logs) {
    const hasR = b.sk && b.r;
    html += '<div class="stLogItem' + (hasR ? ' hasR' : '') + '"><div class="l1">'
      + '<span class="t">' + fmtClock(b.s) + ' – ' + fmtClock(b.e) + '</span>'
      + (b.act ? '<span class="a">' + escHtml(b.act) + '</span>' : '')
      + (b.sk ? '<span class="sk">' + t('skippedTag') + '</span>' : '')
      + (b.f === false ? '<span class="sk nf">' + t('notFocusTag') + '</span>' : '')
      + '<span class="m">' + t('durM')(b.min) + '</span></div>'
      + (hasR ? '<div class="r">' + escHtml(b.r) + '</div>' : '')
      + '</div>';
  }
  return html + '</div>';
}

function renderWeekView() {
  const start = addDaysStr(today.str, -6);
  const days = [];
  for (let i = 0; i < 7; i++) {
    const key = addDaysStr(start, i);
    days.push({ key, stat: dayStatOf(key) });
  }
  const max = Math.max(30, ...days.map((d) => (d.stat ? d.stat.focusMin : 0)));
  let html = '<div class="stBars">';
  for (const d of days) {
    const min = d.stat ? d.stat.focusMin : 0;
    const hPct = Math.max(2, Math.round((min / max) * 100));
    html += '<div class="barCol' + (d.key === today.str ? ' today' : '') + '">'
      + '<div class="barVal">' + (min > 0 ? Math.round(min) : '') + '</div>'
      + '<div class="barWrap"><div class="bar' + (min > 0 ? '' : ' empty') + '" style="height:' + hPct + '%" title="' + d.key + ' · ' + fmtMin(min) + '"></div></div>'
      + '<div class="barLab">' + t('weekShorts')[parseDateStr(d.key).getDay()] + '</div>'
      + '</div>';
  }
  html += '</div>';
  const totalMin = days.reduce((a, d) => a + (d.stat ? d.stat.focusMin : 0), 0);
  const studyDays = days.filter((d) => d.stat && d.stat.focusMin > 0).length;
  html += '<div class="stSummary">'
    + stCell(fmtMin(totalMin), t('statTotal'))
    + stCell(fmtMin(totalMin / 7), t('statAvg'))
    + stCell(studyDays + '/7', t('statStudyDays'))
    + '</div>';
  return html;
}

function renderMonthView() {
  const first = new Date(today.y, today.m - 1, 1);
  const daysInMonth = new Date(today.y, today.m, 0).getDate();
  let totalMin = 0, bestDay = 0, studyDays = 0;
  let cells = '';
  for (let i = 0; i < first.getDay(); i++) cells += '<div class="hCell empty"></div>';
  for (let d = 1; d <= daysInMonth; d++) {
    const key = statDateStr(new Date(today.y, today.m - 1, d));
    const st = dayStatOf(key);
    const min = st ? st.focusMin : 0;
    if (min > 0) { studyDays++; totalMin += min; if (min > bestDay) bestDay = min; }
    const lvl = min <= 0 ? 0 : min < 30 ? 1 : min < 60 ? 2 : min < 120 ? 3 : 4;
    const hasJ = !!(state.journal && state.journal[key]);
    cells += '<div class="hCell' + (lvl ? ' l' + lvl : '') + (hasJ ? ' has-j' : '') + (key === today.str ? ' today' : '') + '"'
      + (hasJ ? ' data-date="' + key + '"' : '')
      + ' title="' + key + ' · ' + fmtMin(min) + (hasJ ? t('jHeatHint') : '') + '"></div>';
  }
  let html = '<div class="stHeatHead">' + t('weekShorts').map((w) => '<span>' + w + '</span>').join('') + '</div>';
  html += '<div class="stHeat">' + cells + '</div>';
  html += '<div class="stSummary">'
    + stCell(fmtMin(totalMin), t('statTotal'))
    + stCell(fmtMin(studyDays ? totalMin / studyDays : 0), t('statAvg'))
    + stCell(fmtMin(bestDay), t('statBestDay'))
    + stCell(studyDays + '/' + daysInMonth, t('statStudyDays'))
    + '</div>';
  return html;
}

function renderYearView() {
  const months = [];
  for (let m = 1; m <= 12; m++) months.push({ m, min: 0, days: 0 });
  for (const key in (state.dailyStats || {})) {
    if (!key.startsWith(today.y + '-')) continue;
    const st = state.dailyStats[key];
    const m = months[Number(key.slice(5, 7)) - 1];
    if (!m || !st) continue;
    m.min += st.focusMin;
    if (st.focusMin > 0) m.days++;
  }
  const max = Math.max(30, ...months.map((x) => x.min));
  const totalMin = months.reduce((a, x) => a + x.min, 0);
  const studyDays = months.reduce((a, x) => a + x.days, 0);
  const bestMonth = months.reduce((a, x) => (x.min > a.min ? x : a), months[0]);
  let html = '<div class="stBars">';
  for (const x of months) {
    const hPct = Math.max(2, Math.round((x.min / max) * 100));
    html += '<div class="barCol' + (x.m === today.m ? ' today' : '') + '">'
      + '<div class="barVal">' + (x.min > 0 ? Math.round(x.min) : '') + '</div>'
      + '<div class="barWrap"><div class="bar' + (x.min > 0 ? '' : ' empty') + '" style="height:' + hPct + '%" title="' + t('monthLabel')(x.m) + ' · ' + fmtMin(x.min) + '"></div></div>'
      + '<div class="barLab">' + (state.language === 'en' ? MONTH_EN[x.m - 1].slice(0, 3) : t('monthLabel')(x.m)) + '</div>'
      + '</div>';
  }
  html += '</div>';
  html += '<div class="stSummary">'
    + stCell(fmtMin(totalMin), t('statTotal'))
    + stCell(studyDays, t('statStudyDays'))
    + stCell(t('monthLabel')(bestMonth.m), t('statBestMonth'))
    + '</div>';
  return html;
}

function renderStatsPanel() {
  if (!statsOverlay.classList.contains('open')) return;
  const st = dayStatOf(today.str);
  lastPanelFocus = st ? st.focusMin : -1;
  const streak = calcStreak();
  let view;
  if (statsRange === 'week') view = renderWeekView();
  else if (statsRange === 'month') view = renderMonthView();
  else if (statsRange === 'year') view = renderYearView();
  else view = renderTodayView();
  $('#statsBody').innerHTML = '<div class="stStreak">'
    + stCell2Chip(streak.cur, t('streakCur')) + stCell2Chip(streak.best, t('streakBest'))
    + '</div>' + view;
}
function stCell2Chip(v, k) {
  return '<div class="chip"><div class="v">' + v + '</div><div class="k">' + k + '</div></div>';
}
// 面板打开期间只在"今日"专注分钟数实际变化时重建视图：
// 每秒全量重绘会打断悬停提示并与按钮点击竞态，近7天/当月/今年则无需实时刷新
function refreshStatsPanelIfStale() {
  if (!statsOverlay.classList.contains('open')) return;
  const st = dayStatOf(today.str);
  const f = st ? st.focusMin : 0;
  if (statsRange === 'today' && f !== lastPanelFocus) renderStatsPanel();
}

function openStats() {
  statsOverlay.classList.add('open');
  renderStatsPanel();
  scheduleBarResize();
}
function closeStatsPanel() {
  statsOverlay.classList.remove('open');
  scheduleBarResize();
}

$('#statsBtn').addEventListener('click', () => { openStats(); });
$('#closeStats').addEventListener('click', () => { closeStatsPanel(); });
statsOverlay.addEventListener('click', (e) => {
  if (e.target === statsOverlay) closeStatsPanel();
});
$('#statsSeg').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-range]');
  if (!btn) return;
  statsRange = btn.dataset.range;
  document.querySelectorAll('#statsSeg button').forEach((b) => b.classList.toggle('active', b === btn));
  renderStatsPanel();
});
// 月视图热力格：写过总结的日子可点击 → 打开该日手记详情
$('#statsBody').addEventListener('click', (e) => {
  if (e.target.closest('#stEditDayBtn')) {
    closeStatsPanel();
    openDayEditor(today.str);
    return;
  }
  const cell = e.target.closest('.hCell.has-j');
  if (cell && cell.dataset.date) {
    closeStatsPanel();
    openJournalPanel(cell.dataset.date);
  }
});
