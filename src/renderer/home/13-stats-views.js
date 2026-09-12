/* ==================== 统计视图：总览 / 趋势 / 热力 / 洞察 ==================== */
/* 由 13-stats.js 的 renderStatsPanel 调用；交互动作经 statsViewAction 分发（13-stats-awards.js） */

let stTrendKind = 'week';   // 'week' | 'month' | 'year'
let stTrendAnchor = '';     // 期内任一天；空串 = 当前期
let stHeatYear = 0;         // 0 = 今年
let stInsRange = '30';      // '30' | 'year' | 'all'

function stDateShort(key) {
  const d = parseDateStr(key);
  return state.language === 'en' ? MONTH_EN[d.getMonth()].slice(0, 3) + ' ' + d.getDate() : (d.getMonth() + 1) + '月' + d.getDate() + '日';
}
function stDateLong(key) {
  const d = parseDateStr(key);
  return stDateShort(key) + ' · ' + (state.language === 'en' ? WEEK_EN[d.getDay()].slice(0, 3) : '周' + WEEK_ZH[d.getDay()]);
}
function stDayTooltip(key, st) {
  let html = '<div class="tt-k">' + stDateLong(key) + '</div><div class="tt-v">' + fmtMinShort(st ? st.focusMin : 0) + '</div>';
  if (st) html += '<div class="tt-s">' + t('statDoneBlocks') + ' ' + st.done + '/' + st.total
    + (st.skipped ? ' · ' + t('statSkipped') + ' ' + st.skipped : '') + '</div>';
  const j = (state.journal || {})[key];
  if (j && j.headline) html += '<div class="tt-s">“' + escHtml(j.headline.slice(0, 24)) + '”</div>';
  return html;
}
/* 今日/日详情共用的块日志列表 */
function stBlocksLogHtml(blocks) {
  let html = '';
  for (const b of blocks) {
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
  return html;
}
/* SVG 图表上的动态 tooltip（径向时钟条 / 散点，无 data-tip 属性） */
function stDynamicTip(el) {
  if (el.classList.contains('stc-rc-bar')) {
    const host = el.closest('.clock');
    if (!host) return '';
    let wd = [], we = [];
    try { wd = JSON.parse(host.dataset.wd || '[]'); we = JSON.parse(host.dataset.we || '[]'); } catch (e) {}
    const h = Number(el.dataset.h) || 0;
    let html = '<div class="tt-k">' + pad2(h) + ':00 – ' + pad2((h + 1) % 24) + ':00</div>';
    if (wd[h]) html += '<div class="tt-v">' + t('workday') + ' ' + Math.round(wd[h]) + ' ' + t('minShort') + '</div>';
    if (we[h]) html += '<div class="tt-s">' + t('in_weekendHol') + ' ' + Math.round(we[h]) + ' ' + t('minShort') + '</div>';
    return html;
  }
  if (el.classList.contains('stc-sc-dot') && el.dataset.key) {
    const st = dayStatOf(el.dataset.key);
    return '<div class="tt-k">' + stDateLong(el.dataset.key) + '</div>'
      + '<div class="tt-v">' + fmtMinShort(st ? st.focusMin : 0) + '</div>'
      + '<div class="tt-s">' + t('jRating') + ' ' + el.dataset.x + '/5</div>';
  }
  return '';
}

function stClockPeak(values) {
  const series = values || [];
  const total = series.reduce((sum, n) => sum + (Number(n) || 0), 0);
  if (!(total > 0)) return null;
  let hour = 0;
  for (let i = 1; i < 24; i++) if ((Number(series[i]) || 0) > (Number(series[hour]) || 0)) hour = i;
  return { hour, min: Math.round(Number(series[hour]) || 0) };
}
function stClockPeakLine(peak, key, dotClass) {
  if (!peak) return '';
  const from = pad2(peak.hour) + ':00', to = pad2((peak.hour + 1) % 24) + ':00';
  return '<div class="stPeakLine stClockPeak"><i class="dot ' + dotClass + '"></i>'
    + tf(key, from + '–' + to, peak.min + ' ' + t('minShort')) + '</div>';
}

/* ---------------- 总览 ---------------- */
let stGoalEditing = false;
function renderOverviewView() {
  const SI = StudyTimerShared;
  const st = dayStatOf(today.str);
  const focus = st ? st.focusMin : 0;
  const done = st ? st.done : 0, total = st ? st.total : 0, skipped = st ? st.skipped : 0;
  const rate = total > 0 ? Math.round((done / total) * 100) : 0;
  const goal = (state.goals && state.goals.dailyMin) || 0;
  const streak = calcStreak();
  const bal = SI.pointsBalance(state.dailyStats, state.points, state.achievements);
  const goalPct = goal > 0 ? Math.min(1, focus / goal) : 0;

  let html = '<div class="stHero">'
    + '<div class="grow">'
    + '<div class="num"><span class="cu" data-to="' + focus + '">0</span><small>' + t('minShort') + '</small></div>'
    + '<div class="k">' + t('todayFocus') + (goal > 0 && focus >= goal ? ' · ' + t('goalHit') : '') + '</div>'
    + '</div>'
    + '<div class="stRingWrap" data-act="goal-edit" role="button" tabindex="0" data-tip="' + escHtml(goal > 0 ? tf('goalEditHint') + '：' + goal + ' ' + t('minShort') : t('goalSet')) + '">'
    + SI.ring(goalPct)
    + '<div class="stRingText"><span>' + (goal > 0 ? Math.round(goalPct * 100) + '%' : '') + '</span><span class="k">' + (goal > 0 ? goal : t('goalSet')) + '</span></div>'
    + '</div></div>';

  if (stGoalEditing) {
    html += '<div class="stGoalEdit"><span style="align-self:center;font-size:11px;color:var(--text2)">' + t('goalEditHint') + '</span>'
      + [60, 120, 180, 240, 300].map((m) => '<button data-act="goal-set" data-min="' + m + '"' + (m === goal ? ' style="border-color:var(--study);color:var(--study)"' : '') + '>' + m + '</button>').join('')
      + (goal > 0 ? '<button class="off" data-act="goal-set" data-min="0">' + t('goalOff') + '</button>' : '')
      + '</div>';
  }

  html += '<div class="stSummary">'
    + stCell(rate + '%', t('statRate'))
    + stCell(skipped, t('statSkipped'))
    + stCell(streak.cur + ' ' + t('dayUnit'), t('streakCur'))
    + '</div>';

  // 近 7 天迷你柱（点柱钻取日详情）
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const key = addDaysStr(today.str, -i);
    const s = dayStatOf(key);
    days.push({ key, min: s ? s.focusMin : 0 });
  }
  const max7 = Math.max(30, ...days.map((d) => d.min));
  html += '<div class="stLogTitle" style="margin-top:16px">' + t('last7') + '</div><div class="stBars">';
  for (const d of days) {
    const hPct = Math.max(2, Math.round((d.min / max7) * 100));
    html += '<div class="barCol' + (d.key === today.str ? ' today' : '') + '" data-act="day" data-date="' + d.key + '" data-tip="' + escHtml(stDayTooltip(d.key, dayStatOf(d.key))) + '">'
      + '<div class="barVal">' + (d.min > 0 ? Math.round(d.min) : '') + '</div>'
      + '<div class="barWrap"><div class="bar' + (d.min > 0 ? '' : ' empty') + '"' + stHAttr(hPct) + '></div></div>'
      + '<div class="barLab">' + t('weekShorts')[parseDateStr(d.key).getDay()] + '</div>'
      + '</div>';
  }
  html += '</div>';

  html += '<div class="stCard full" style="margin-top:12px"><div class="stPtsCard">'
    + '<div class="ic">' + iconSvg('gift', { size: 20 }) + '</div>'
    + '<div><div class="v cu" data-to="' + bal.balance + '">0</div><div class="k">' + t('ptsBalance') + ' · ' + t('ptsRule') + '</div></div>'
    + '<button class="ghostBtn go" data-act="goto-awards">' + iconText('gift', t('ptsGo')) + '</button>'
    + '</div></div>';

  // 今日学习记录（沿用原有日志列表）
  const logs = (st && st.blocks) || [];
  if (!logs.length) {
    html += '<div class="stEmpty">' + t('statsEmpty') + '</div>';
  } else {
    html += '<div class="stLogTitle" style="margin-top:16px">' + t('todayLogTitle')
      + '<button data-act="layer-edit-day" data-date="' + today.str + '">' + iconText('edit', t('editDayBtn')) + '</button></div>'
      + '<div class="stLog">' + stBlocksLogHtml(logs) + '</div>';
  }
  return html;
}

/* ---------------- 趋势 ---------------- */
function stTrendSeries() {
  let anchor = stTrendAnchor || today.str;
  if (stTrendKind === 'year') anchor = anchor.slice(0, 4) + '-01-01';
  return StudyTimerShared.periodSeries(state.dailyStats || {}, state.journal || {}, { kind: stTrendKind, anchor });
}
function stTrendChart(series) {
  const items = series.list;
  const max = Math.max(30, ...items.map((x) => x.min));
  const isYear = series.kind === 'year';
  let cols = '', labels = '';
  items.forEach((it, i) => {
    const pct = Math.max(2, Math.round((it.min / max) * 100));
    const tip = isYear
      ? '<div class="tt-k">' + tf('trMonthLabel', Number(it.key.slice(0, 4)), it.m) + '</div><div class="tt-v">' + fmtMinShort(it.min) + '</div><div class="tt-s">' + t('statStudyDays') + ' ' + it.days + '</div>'
      : stDayTooltip(it.key, dayStatOf(it.key));
    const act = it.future ? '' : (isYear ? ' data-act="trend-month" data-anchor="' + it.key + '-01"' : ' data-act="day" data-date="' + it.key + '"');
    const isNow = isYear ? (it.m === today.m && Number(it.key.slice(0, 4)) === today.y) : it.key === today.str;
    cols += '<div class="stCol' + (it.future ? ' future' : '') + (isNow ? ' today' : '') + '"' + act
      + (it.future ? '' : ' data-tip="' + escHtml(tip) + '"') + '>'
      + '<div class="stFill' + (it.min > 0 ? '' : ' empty') + '"' + stHAttr(pct) + '></div></div>';
    let lab = '';
    if (series.kind === 'week') lab = t('weekShorts')[it.dow];
    else if (isYear) lab = state.language === 'en' ? MONTH_EN[it.m - 1].slice(0, 3) : t('monthLabel')(it.m);
    else { // 月视图稀疏标注
      const d = Number(it.key.slice(8, 10));
      if (d === 1 || d % 7 === 1 || i === items.length - 1) lab = String(d);
    }
    labels += '<span>' + lab + '</span>';
  });
  let avgLine = '', maLine = '';
  if (!isYear) {
    const avgPct = Math.max(0, Math.min(100, (series.avgPerDay / max) * 100));
    avgLine = '<div class="stAvgLine" style="bottom:' + avgPct + '%"><span>' + fmtMinShort(series.avgPerDay) + '</span></div>';
  }
  if (series.kind === 'month') {
    maLine = '<div class="stMaLine">' + StudyTimerShared.sparkline(items.map((x) => x.ma), { max }) + '</div>';
  }
  return '<div class="stChart"><div class="stPlot">' + avgLine + '<div class="stCols">' + cols + '</div>' + maLine + '</div>'
    + '<div class="stChartX">' + labels + '</div></div>';
}
function renderTrendView() {
  const series = stTrendSeries();
  const isYear = stTrendKind === 'year';
  // 期间标签与导航边界
  let label, prevOut, nextOut, canPrev = true, canNext = true;
  if (stTrendKind === 'week') {
    label = tf('trRange', stDateShort(series.from), stDateShort(series.to));
    prevOut = addDaysStr(series.anchor, -7);
    nextOut = addDaysStr(series.anchor, 7);
    canNext = series.to < today.str;
  } else if (stTrendKind === 'month') {
    const a = parseDateStr(series.anchor);
    label = tf('trMonthLabel', a.getFullYear(), a.getMonth() + 1);
    const prev = new Date(a.getFullYear(), a.getMonth() - 1, 15);
    const next = new Date(a.getFullYear(), a.getMonth() + 1, 15);
    prevOut = statDateStr(prev);
    nextOut = statDateStr(next);
    canNext = series.to < today.str;
  } else {
    const y = Number(series.anchor.slice(0, 4));
    label = tf('trYearLabel', y);
    prevOut = (y - 1) + '-06-01';
    nextOut = (y + 1) + '-06-01';
    canNext = y < today.y;
  }
  const keys = Object.keys(state.dailyStats || {});
  const dataYears = keys.map((k) => Number(k.slice(0, 4)));
  const minYear = dataYears.length ? Math.min.apply(null, dataYears) : today.y;
  canPrev = prevOut.slice(0, 4) >= String(minYear);

  let html = '<div class="stTrendHead">'
    + '<div class="stPillSeg">'
    + ['week', 'month', 'year'].map((k) => '<button data-act="trend-kind" data-kind="' + k + '"' + (k === stTrendKind ? ' class="active"' : '') + '>' + t('tr_' + k) + '</button>').join('')
    + '</div>'
    + (!isYear ? '<button class="ghostBtn" data-act="report">' + iconText('journal', t('rpBtn')) + '</button>' : '')
    + '<div class="stTrendNav">'
    + '<button class="stNavBtn" data-act="trend-prev" data-anchor="' + prevOut + '"' + (canPrev ? '' : ' disabled') + ' aria-label="prev">' + iconSvg('back', { size: 14 }) + '</button>'
    + '<span class="lab">' + label + '</span>'
    + '<button class="stNavBtn" data-act="trend-next" data-anchor="' + nextOut + '"' + (canNext ? '' : ' disabled') + ' aria-label="next" style="transform:scaleX(-1)">' + iconSvg('back', { size: 14 }) + '</button>'
    + '</div></div>';

  html += '<div class="stTrendWrap">' + stTrendChart(series) + '</div>';

  const deltaCell = series.deltaPct === null ? '—'
    : '<span class="' + (series.deltaPct >= 0 ? 'stDeltaUp' : 'stDeltaDown') + '">' + (series.deltaPct >= 0 ? '+' : '') + series.deltaPct + '%</span>';
  const bestCell = !series.best ? '—'
    : isYear
      ? (state.language === 'en' ? MONTH_EN[series.best.m - 1].slice(0, 3) : t('monthLabel')(series.best.m)) + ' · ' + fmtMinShort(series.best.min)
      : fmtMinShort(series.best.min);
  html += '<div class="stSummary">'
    + stCell(fmtMinShort(series.totalMin), t('statTotal'))
    + stCell(deltaCell, t('trDelta'))
    + stCell(fmtMinShort(series.avgPerDay), t('statAvg'))
    + stCell(series.studyDays + '/' + series.periodDays, t('statStudyDays'))
    + stCell(bestCell, t(isYear ? 'statBestMonth' : 'statBestDay'))
    + '</div>';
  return html;
}

/* ---------------- 热力：全年贡献图 ---------------- */
function renderHeatView() {
  const SI = StudyTimerShared;
  const year = stHeatYear || today.y;
  const hm = SI.yearHeatmap(state.dailyStats || {}, state.journal || {}, year, today.str);
  const keys = Object.keys(state.dailyStats || {});
  const minYear = keys.length ? Math.min(...keys.map((k) => Number(k.slice(0, 4)))) : today.y;

  let months = '', lastCol = -99;
  for (const mk of hm.monthMarks) {
    if (mk.col - lastCol < 3 && mk.m !== 1) continue;
    lastCol = mk.col;
    months += '<span style="left:' + (mk.col * 13) + 'px">' + (state.language === 'en' ? MONTH_EN[mk.m - 1].slice(0, 3) : t('monthLabel')(mk.m)) + '</span>';
  }
  const dayNames = state.language === 'en' ? ['M', '', 'W', '', 'F', '', 'S'] : ['一', '', '三', '', '五', '', '日'];
  const dayLabels = dayNames.map((x) => '<span>' + x + '</span>').join('');

  let colsHtml = '';
  hm.cols.forEach((col, ci) => {
    let rows = '';
    col.forEach((cell, ri) => {
      if (!cell) { rows += '<div class="stYCell void"></div>'; return; }
      const cls = 'stYCell' + (cell.lvl ? ' l' + cell.lvl : '') + (cell.future ? ' future' : '') + (cell.today ? ' today' : '') + (cell.hasJ ? ' has-j' : '');
      const attrs = cell.future ? '' : ' data-act="day" data-date="' + cell.key + '" data-tip="' + escHtml(stDayTooltip(cell.key, dayStatOf(cell.key))) + '"';
      rows += '<div class="' + cls + '" style="--d:' + ((ci + ri) * 16) + 'ms"' + attrs + '></div>';
    });
    colsHtml += '<div class="stYCol">' + rows + '</div>';
  });

  let html = '<div class="stTrendHead">'
    + '<div class="stTrendNav" style="margin-left:0">'
    + '<button class="stNavBtn" data-act="heat-prev" data-year="' + (year - 1) + '"' + (year > minYear ? '' : ' disabled') + ' aria-label="prev">' + iconSvg('back', { size: 14 }) + '</button>'
    + '<span class="lab">' + tf('trYearLabel', year) + '</span>'
    + '<button class="stNavBtn" data-act="heat-next" data-year="' + (year + 1) + '"' + (year < today.y ? '' : ' disabled') + ' aria-label="next" style="transform:scaleX(-1)">' + iconSvg('back', { size: 14 }) + '</button>'
    + '</div>'
    + '<div class="stHeatLegend" style="margin-left:auto">' + t('htLess')
    + '<i></i><i class="l1"></i><i class="l2"></i><i class="l3"></i><i class="l4"></i>' + t('htMore') + '</div>'
    + '</div>';
  html += '<div class="stHeatScroll"><div class="stHeatInner">'
    + '<div class="stYMonths">' + months + '</div>'
    + '<div style="display:flex"><div class="stYDays">' + dayLabels + '</div><div class="stYBody">' + colsHtml + '</div></div>'
    + '</div></div>';
  html += '<div class="stSummary">'
    + stCell(fmtMinShort(hm.totalMin), t('statTotal'))
    + stCell(hm.activeDays, t('statStudyDays'))
    + stCell(hm.bestStreak + ' ' + t('dayUnit'), t('htBestStreak'))
    + '</div>';
  return html;
}

/* ---------------- 应用：前台应用使用 ---------------- */
let stAppsRange = 'today';  // 'today' | '7d' | 'month' | 'year' | 'all'
function stAppsWindow() {
  if (stAppsRange === 'today') return { from: today.str, to: today.str };
  if (stAppsRange === '7d') return { from: addDaysStr(today.str, -6), to: today.str };
  if (stAppsRange === 'month') return { from: today.str.slice(0, 7) + '-01', to: today.str };
  if (stAppsRange === 'year') return { from: today.y + '-01-01', to: today.str };
  const keys = Object.keys((getAppUsage() || {}).days || {})
    .concat(Object.keys(state.dailyStats || {})).sort();
  return { from: keys.length ? keys[0] : today.str, to: today.str };
}
function stAppsTipHtml(a) {
  const total = a.total > 0 ? a.total : 1;
  const row = (label, v) => '<div class="tt-s">' + label + ' ' + fmtMinShort(v)
    + ' · ' + Math.round((v / total) * 100) + '%</div>';
  return '<div class="tt-k">' + escHtml(a.name) + '</div><div class="tt-v">' + fmtMinShort(a.total) + '</div>'
    + row(t('au_study'), a.study) + row(t('au_brk'), a.brk) + row(t('au_other'), a.other);
}
function renderAppsView() {
  const AUM = StudyTimerShared.appUsage;
  const deps = { modeFor: StudyTimerShared.modeFor, mergeExtraSessions: StudyTimerShared.mergeExtraSessions, expandDay: StudyTimerShared.expandDay };
  const win = stAppsWindow();
  const agg = AUM.aggregate(getAppUsage(), state, win.from, win.to, deps);

  let html = '<div class="stTrendHead"><div class="stPillSeg">'
    + [['today', 'au_rangeToday'], ['7d', 'au_range7'], ['month', 'au_rangeMonth'], ['year', 'in_rangeYear'], ['all', 'in_rangeAll']].map((r) =>
      '<button data-act="apps-range" data-range="' + r[0] + '"' + (stAppsRange === r[0] ? ' class="active"' : '') + '>' + t(r[1]) + '</button>').join('')
    + '</div></div>';

  if (!(agg.trackMin > 0)) {
    html += '<div class="stEmpty">' + t('au_empty') + '</div>';
    return html;
  }

  html += '<div class="stSummary">'
    + stCell(fmtMinShort(agg.trackMin), t('au_track'))
    + stCell(agg.days + ' ' + t('dayUnit'), t('au_days'))
    + '<div class="cell"><div class="v"><i class="auDot auS"></i>' + fmtMinShort(agg.cats.study) + '</div><div class="k">' + t('au_study') + '</div></div>'
    + '<div class="cell"><div class="v"><i class="auDot auB"></i>' + fmtMinShort(agg.cats.brk) + '</div><div class="k">' + t('au_brk') + '</div></div>'
    + '<div class="cell"><div class="v"><i class="auDot auO"></i>' + fmtMinShort(agg.cats.other) + '</div><div class="k">' + t('au_other') + '</div></div>'
    + '</div>';

  const top = agg.apps.slice(0, 12);
  const maxA = Math.max(1, ...top.map((a) => a.total));
  html += '<div class="stLogTitle" style="margin-top:16px">' + t('au_appList') + '</div><div class="auList">';
  top.forEach((a, i) => {
    const seg = (v, cls) => {
      if (!(v > 0)) return '';
      const pct = Math.max(2, Math.round((v / maxA) * 100));
      return '<i class="' + cls + '" style="width:' + pct + '%"' + stWAttr(pct) + '></i>';
    };
    html += '<div class="auItem stFade" style="--d:' + (i * 30) + 'ms" data-tip="' + escHtml(stAppsTipHtml(a)) + '">'
      + '<div class="r1"><span class="nm">' + escHtml(a.name) + '</span><span class="ct">' + fmtMinShort(a.total) + '</span></div>'
      + '<div class="auBar">' + seg(a.study, 'auS') + seg(a.brk, 'auB') + seg(a.other, 'auO') + '</div></div>';
  });
  html += '</div>';
  if (agg.apps.length > top.length) html += '<div class="auMore">' + tf('au_more', agg.apps.length - top.length) + '</div>';
  return html;
}

/* ---------------- 洞察 ---------------- */
function stInsWindow() {
  if (stInsRange === 'year') return { from: today.y + '-01-01', to: today.str };
  if (stInsRange === '30') return { from: addDaysStr(today.str, -29), to: today.str };
  const keys = Object.keys(state.dailyStats || {}).sort();
  return { from: keys.length ? keys[0] : today.str, to: today.str };
}
function stCard(title, icon, inner, extraCls, delay) {
  return '<div class="stCard stFade ' + (extraCls || '') + '" style="--d:' + delay + 'ms">'
    + '<div class="stCardTitle">' + iconSvg(icon, { size: 13 }) + title + '</div>' + inner + '</div>';
}
function renderInsightsView() {
  const SI = StudyTimerShared;
  const win = stInsWindow();
  const ds = state.dailyStats || {};

  let html = '<div class="stTrendHead"><div class="stPillSeg">'
    + [['30', 'in_range30'], ['year', 'in_rangeYear'], ['all', 'in_rangeAll']].map((r) =>
      '<button data-act="ins-range" data-range="' + r[0] + '"' + (stInsRange === r[0] ? ' class="active"' : '') + '>' + t(r[1]) + '</button>').join('')
    + '</div></div>';

  html += '<div class="stGrid">';

  // 黄金时段：径向时钟（工作日主色 + 周末·节假日辅色）
  const hd = SI.hourDistribution(ds, { from: win.from, to: win.to, holidays: state.holidays, makeup: state.makeup, override: state.override });
  const wdPeak = stClockPeak(hd.workday), wePeak = stClockPeak(hd.weekend);
  const clockInner = hd.totalMin > 0
    ? '<div class="stClockWrap">'
      + '<div class="clock" data-wd="' + escHtml(JSON.stringify(hd.workday)) + '" data-we="' + escHtml(JSON.stringify(hd.weekend)) + '">'
      + SI.radialClock(hd.workday, { values2: hd.weekend }) + '</div>'
      + '<div class="stClockSide">'
      + '<div class="stLegend"><span class="s1"><i></i>' + t('workday') + '</span><span class="s2"><i></i>' + t('in_weekendHol') + '</span></div>'
      + stClockPeakLine(wdPeak, 'in_clockPeakWorkday', 's1')
      + stClockPeakLine(wePeak, 'in_clockPeakWeekend', 's2')
      + '<div class="stPeakLine" style="color:var(--text2);font-size:11px">' + tf('in_clockDays', hd.days) + '</div>'
      + '</div></div>'
    : '<div class="stEmptyCard">' + t('statsEmpty') + '</div>';
  html += stCard(t('in_clock'), 'time', clockInner, 'full', 0);

  // 活动榜
  const acts = SI.activityTop(ds, { from: win.from, to: win.to, n: 8 });
  let actInner;
  if (acts.length) {
    const maxA = Math.max(1, ...acts.map((a) => a.min));
    actInner = '<div class="stActRow">' + acts.map((a) => {
      const pct = Math.max(4, Math.round((a.min / maxA) * 100));
      return '<div class="stActItem"><div class="r1"><span class="nm">' + escHtml(a.name) + '</span>'
        + '<span class="ct">' + tf('in_times', a.count) + ' · ' + fmtMinShort(a.min) + '</span></div>'
        + '<div class="track"><div class="fill"' + stWAttr(pct) + '></div></div></div>';
    }).join('') + '</div>';
  } else actInner = '<div class="stEmptyCard">' + t('in_actsEmpty') + '</div>';
  html += stCard(t('in_acts'), 'tag', actInner, '', 50);

  // 跳过分析
  const sk = SI.skipAnalysis(ds, state.skips || {}, { from: win.from, to: win.to });
  let skipInner;
  if (sk.totalBlocks > 0) {
    const totalSkipped = sk.totalSkipped;
    const pct = Math.round(sk.rate * 100);
    skipInner = '<div class="stSkipTop"><span class="summary">' + escHtml(tf('in_skipSummary', totalSkipped, pct)) + '</span></div>'
    + (sk.peakHour != null ? '<div class="stPeakLine stSkipPeak">' + escHtml(tf('in_skipPeak', pad2(sk.peakHour) + ':00–' + pad2((sk.peakHour + 1) % 24) + ':00')) + '</div>' : '')
    + (sk.reasons.length ? '<div>' + sk.reasons.slice(0, 5).map((r) => {
      const reasonPct = totalSkipped > 0 ? Math.round((r.count / totalSkipped) * 100) : 0;
      return '<div class="stReasonRow"><span class="txt">' + escHtml(tf('in_skipReason', r.reason, r.count, reasonPct)) + '</span>'
        + '<span class="bar"' + stWAttr(reasonPct) + '></span></div>';
    }).join('') + '</div>' : '')
    + (sk.noReasonCount > 0 ? '<div class="stSkipNoReason">' + escHtml(tf('in_skipNoReason', sk.noReasonCount)) + '</div>' : '');
  } else skipInner = '<div class="stEmptyCard">' + t('in_skipNone') + '</div>';
  html += stCard(t('in_skip'), 'skip', skipInner, '', 100);

  // 手记 × 数据
  const jc = SI.journalCorrelation(state.journal || {}, ds);
  let jInner;
  if (jc.count) {
    const moodRow = '<div class="stMoodRow">' + [0, 1, 2, 3, 4].map((m) =>
      '<div class="stMoodCell' + (jc.mood[m] ? ' on' : '') + '">' + iconSvg('mood' + m, { size: 20 }) + '<span class="n">' + (jc.mood[m] || '') + '</span></div>').join('') + '</div>';
    const tags = jc.tags.length ? '<div class="stTagChips">' + jc.tags.slice(0, 8).map((x) => '<span>' + escHtml(x.name) + ' <b>×' + x.count + '</b></span>').join('') + '</div>' : '';
    let scatter = '';
    if (jc.scatter.length > 1) {
      const yMax = Math.max(60, ...jc.scatter.map((p) => p.min)) * 1.08;
      scatter = '<div class="stCardTitle" style="margin:4px 0 6px">' + t('in_scatterHint')
        + (jc.ratingAvg ? '<span class="hint">' + tf('in_ratingAvg', Math.round(jc.ratingAvg * 10) / 10) + '</span>' : '') + '</div>'
        + SI.scatter(jc.scatter.map((p) => ({ x: p.rating, y: p.min, key: p.key })), { xDomain: [0.5, 5.5], yDomain: [0, yMax] });
    }
    jInner = moodRow + tags + scatter;
  } else jInner = '<div class="stEmptyCard">' + t('in_journalEmpty') + '</div>';
  html += stCard(t('in_journal'), 'journal', jInner, 'full', 150);

  // 学习日对比
  const tc = SI.dayTypeCompare(ds, { from: win.from, to: win.to, holidays: state.holidays, makeup: state.makeup, override: state.override });
  const tList = [['workday', t('workday')], ['weekend', t('weekend')], ['holiday', t('holiday')]];
  const anyType = tList.some((x) => tc[x[0]].days > 0);
  let tInner;
  if (anyType) {
    const maxT = Math.max(1, ...tList.map((x) => tc[x[0]].avgMin));
    tInner = '<div class="stTypeBars">' + tList.map((x) => {
      const b = tc[x[0]];
      const pct = b.avgMin > 0 ? Math.max(4, Math.round((b.avgMin / maxT) * 100)) : 2;
      return '<div class="stTypeCol" data-tip="' + escHtml(tf('in_typeAvg', fmtMinShort(b.avgMin))) + '">'
        + '<span class="v">' + (b.avgMin > 0 ? Math.round(b.avgMin) : '') + '</span>'
        + '<div class="bar"' + stHAttr(pct) + '></div>'
        + '<span class="k">' + x[1] + '</span>'
        + '<span class="r">' + tf('in_typeRate', b.studyDays, b.days) + '</span></div>';
    }).join('') + '</div>';
  } else tInner = '<div class="stEmptyCard">' + t('statsEmpty') + '</div>';
  html += stCard(t('in_types'), 'stats', tInner, '', 200);

  // 加钟主动性
  const et = SI.extraTrend(state.extra || {}, { anchor: today.str });
  let eInner;
  if (et.total > 0) {
    const maxE = Math.max(1, ...et.list.map((x) => x.count));
    eInner = '<div class="stCardTitle" style="margin:0 0 8px">' + tf('in_extraTotal', et.total) + '</div>'
      + '<div class="stMiniBars">' + et.list.map((x) => {
        const pct = x.count > 0 ? Math.max(6, (x.count / maxE) * 100) : 2;
        return '<div class="mb" ' + stHAttr(pct) + ' data-tip="' + escHtml(x.ym + ' · ' + x.count) + '"></div>';
      }).join('') + '</div>'
      + '<div class="stMiniX">' + et.list.map((x) => '<span>' + Number(x.ym.slice(5, 7)) + '</span>').join('') + '</div>';
  } else eInner = '<div class="stEmptyCard">' + t('in_extraEmpty') + '</div>';
  html += stCard(t('in_extra'), 'add', eInner, '', 250);

  html += '</div>';
  return html;
}
