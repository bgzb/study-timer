/* ==================== 主渲染循环 ==================== */

let today = null, modeInfo = null, day = null;
let lastStateKey = null, lastStatsWrite = 0;
let currentQuote = '';
let currentFillEl = null;

// 注意：这里绝不能压制/预置 lastStateKey —— owner 窗口每 60s 落盘一次统计，
// 若每次同步都重置"抑制一次"，到点的相位切换通知会被吃掉。
// 唯一豁免是页面首次加载（lastStateKey === null），见 tick()。
function rebuildDay() {
  today = getToday();
  modeInfo = detectMode(today);
  day = expandDay(mergeExtraSessions(state.schedules[modeInfo.mode] || [], (state.extra || {})[today.str] || []), state.skips[today.str] || []);
  renderHeader();
  renderTimeline();
}

function renderHeader() {
  const isEn = state.language === 'en';
  $('#dateLine').textContent = isEn
    ? WEEK_EN[today.dow] + ', ' + MONTH_EN[today.m - 1] + ' ' + today.d
    : today.m + '月' + today.d + '日 星期' + WEEK_ZH[today.dow];
  const badge = $('#modeBadge');
  badge.className = 'badge badge-' + modeInfo.mode + (modeInfo.manual ? ' manual' : '');
  const names = { workday: t('workday'), weekend: t('weekend'), holiday: t('holiday') };
  badge.textContent = names[modeInfo.mode] + (modeInfo.note ? ' · ' + modeInfo.note : '');
  badge.title = modeInfo.manual ? t('manualTip') : t('autoTip');
}

function renderPhase(st) {
  const card = $('#phaseCard');
  const label = $('#phaseLabel');
  const cd = $('#countdown');
  const range = $('#phaseRange');
  const next = $('#nextLine');
  const bar = $('#phaseBar');
  const now = nowSeconds();

  card.className = 'ph-' + st.phase;
  if (st.phase === 'study' || st.phase === 'break') {
    const isStudy = st.phase === 'study';
    setIconLabel(label, isStudy ? 'study' : 'break', (isStudy ? t('studying') : t('breakTime')) + ' · ' + st.session.name);
    cd.textContent = fmtCountdown(st.block.effEnd - now);
    range.textContent = blockRangeText(st.block);
    const nbAny = day.blocks.find((b) => b.effEnd > st.block.effEnd + 0.5);
    if (nbAny) {
      const n = nbAny;
      next.textContent = t('nextBlock')(n.type === 'study' ? t('studyWord') : t('breakWord'), fmtClock(n.start));
    } else {
      next.textContent = t('doneAfterBlock');
    }
    const total = st.block.effEnd - st.block.start;
    bar.style.width = (total > 0 ? Math.min(100, ((now - st.block.start) / total) * 100) : 100) + '%';
  } else if (st.phase === 'gap') {
    // 跳过截出的间隙：倒计时到下一块原定开始，进度条按间隙流逝比例
    const word = st.next.type === 'study' ? t('studyWord') : t('breakWord');
    setIconLabel(label, 'skip', t('gapLabel')(word, fmtClock(st.next.start)));
    cd.textContent = fmtCountdown(st.next.start - now);
    range.textContent = t('gapRange')(latestSkipReason());
    next.textContent = t('nextBlock')(word, fmtClock(st.next.start));
    const gTotal = st.next.start - st.gapStart;
    bar.style.width = (gTotal > 0 ? Math.min(100, ((now - st.gapStart) / gTotal) * 100) : 100) + '%';
  } else if (st.phase === 'wait') {
    setIconLabel(label, 'time', t('waitLabel')(st.next.name, fmtClock(st.next.start)));
    cd.textContent = fmtCountdown(st.next.start - now);
    range.textContent = t('nowLongBreak');
    next.textContent = t('nextSessionStudy')(st.next.name, fmtClock(st.next.start));
    bar.style.width = '0%';
  } else {
    setIconLabel(label, 'done', t('doneToday'));
    const stats = computeStats(day);
    cd.textContent = t('doneWord');
    range.textContent = t('doneStats')(stats.done, stats.total, stats.focusMin);
    next.textContent = t('restWell');
    bar.style.width = '100%';
  }
  document.title = cd.textContent + ' · ' + t('appName');
}

function setTimelineTip(el, text) {
  if (!text) return;
  el.dataset.tooltip = text;
  el.setAttribute('aria-label', text);
  el.tabIndex = 0;
}

function showTimelineTooltip(target) {
  const tooltip = $('#timelineTooltip');
  const text = target && target.dataset.tooltip;
  if (!tooltip || !text) return;
  tooltip.textContent = text;
  tooltip.classList.add('show');
  tooltip.setAttribute('aria-hidden', 'false');
  const position = StudyTimerShared.timelineTooltipPosition(
    target.getBoundingClientRect(),
    tooltip.getBoundingClientRect(),
    { width: window.innerWidth, height: window.innerHeight }
  );
  tooltip.style.left = position.left + 'px';
  tooltip.style.top = position.top + 'px';
}

function hideTimelineTooltip() {
  const tooltip = $('#timelineTooltip');
  if (!tooltip) return;
  tooltip.classList.remove('show');
  tooltip.setAttribute('aria-hidden', 'true');
}

const timelineCardEl = $('#timelineCard');
timelineCardEl.addEventListener('pointerover', (e) => {
  const target = e.target.closest('[data-tooltip]');
  if (target && timelineCardEl.contains(target)) showTimelineTooltip(target);
});
timelineCardEl.addEventListener('pointerout', (e) => {
  const target = e.target.closest('[data-tooltip]');
  if (target && !target.contains(e.relatedTarget)) hideTimelineTooltip();
});
timelineCardEl.addEventListener('focusin', (e) => {
  const target = e.target.closest('[data-tooltip]');
  if (target) showTimelineTooltip(target);
});
timelineCardEl.addEventListener('focusout', hideTimelineTooltip);
window.addEventListener('resize', hideTimelineTooltip);

function renderTimeline() {
  const bars = $('#timelineBars');
  const labels = $('#timelineLabels');
  hideTimelineTooltip();
  bars.innerHTML = '';
  labels.innerHTML = '';
  currentFillEl = null;
  if (!day.sess.length) {
    bars.innerHTML = '<div class="tl-seg tl-gap" style="flex:1"></div>';
    return;
  }
  const t0 = day.sess[0].start;
  const t1 = day.sess[day.sess.length - 1].end;
  const now = nowSeconds();
  const items = [];
  let cursor = t0;
  let curBlock = null;
  const skipMap = {};
  for (const x of (state.skips[today.str] || [])) skipMap[x.key] = x;
  let prevBlock = null;
  for (const b of day.blocks) {
    // 间隙段（跳过截断/会话之间）携带来源块，便于悬停显示跳过原因
    if (b.start > cursor) {
      const skp = prevBlock && prevBlock.effEnd < prevBlock.end ? prevBlock : null;
      items.push({ type: 'gap', start: cursor, end: b.start, from: skp, reason: skp ? (skipMap[skp.key] || {}).reason : undefined });
    }
    const active = b.start <= now && now < b.effEnd;
    items.push({ type: b.type, start: b.start, end: b.effEnd, block: b, active });
    if (active) curBlock = b;
    cursor = b.effEnd;
    prevBlock = b;
  }
  if (t1 > cursor) {
    const skp = prevBlock && prevBlock.effEnd < prevBlock.end ? prevBlock : null;
    items.push({ type: 'gap', start: cursor, end: t1, from: skp, reason: skp ? (skipMap[skp.key] || {}).reason : undefined });
  }

  for (const it of items) {
    const el = document.createElement('div');
    el.className = 'tl-seg tl-' + it.type;
    if (it.type !== 'gap') el.className += (it.end <= now ? ' tl-past' : '') + (it.active ? ' tl-current' : '');
    el.style.flexGrow = String(Math.max(1, it.end - it.start));
    if (it.block) {
      setTimelineTip(el, day.sess[it.block.sIdx].name + ' ' + fmtClock(it.block.start) + '–' + fmtClock(it.block.effEnd) + ' ' +
        (it.block.type === 'study' ? t('studyWord') : t('breakWord')) + ' ' + it.block.minutes + t('min'));
    } else if (it.from) {
      setTimelineTip(el, t('skippedTag') + (it.reason ? ' · ' + it.reason : ''));
    }
    if (it.active && it.block) {
      const fill = document.createElement('div');
      fill.className = 'tl-fill';
      el.appendChild(fill);
      currentFillEl = { el: fill, block: it.block };
    }
    bars.appendChild(el);
  }
  const markers = StudyTimerShared.buildTimelineMarkers(day.sess, t0, t1);
  for (const markerInfo of markers) {
    const marker = document.createElement('div');
    marker.className = markerInfo.type === 'end'
      ? 'tl-marker tl-marker-end'
      : 'tl-marker' + (markerInfo.isExtra ? ' tl-marker-extra' : '');
    marker.style.left = markerInfo.position + '%';
    marker.setAttribute('role', 'img');
    if (markerInfo.type === 'end') {
      const text = t('endAt') + ' ' + fmtClock(t1);
      setTimelineTip(marker, text);
    } else {
      const session = day.sess[markerInfo.sessionIndex];
      const text = session.name + ' ' + fmtClock(session.start) + '–' + fmtClock(session.end) +
        (session.isExtra ? ' · ' + t('extraTitle') : '');
      setTimelineTip(marker, text);
    }
    labels.appendChild(marker);
  }
}

function renderStats() {
  const stats = computeStats(day);
  $('#statsText').innerHTML = t('stats')(stats.done, stats.total, stats.focusMin);
  const st = currentState(day);
  $('#skipBtn').disabled = !(st.phase === 'study' || st.phase === 'break');
  // 当天已结束但总结未填写（也未跳过）时，抽屉里的手记图标挂小圆点提醒
  const journalItem = $('#toolDrawer .td-item[data-tool="journal"]');
  if (journalItem) journalItem.classList.toggle(
    'pending',
    st.phase === 'done' && !state.journal[today.str] && !state.summaryDismissed[today.str]
  );
}

function setQuote(st) {
  const q = StudyTimerShared.quoteForState(st, () => pickQuote(currentPoolOf(st)));
  currentQuote = q;
  $('#quoteText').textContent = q;
  scheduleBarResize();
}

function tick() {
  const t = getToday();
  if (t.str !== today.str) {
    // 跨天：以 23:59:59 结算昨天的最终轨迹。此刻真实时钟已进入新的一天，
    // 若直接用 nowSeconds() 重算"昨天到现在"会得到全零，覆盖掉昨天的记录
    recordTodayStats(86399);
    rebuildDay();
  }
  const st = currentState(day);
  const key = stateKeyOf(st);
  if (key !== lastStateKey) {
    // lastStateKey === null 仅出现在页面首次加载：只建立基准、不补发通知
    // （中途打开应用不回放已过去的提醒）；此后任何相位变化都必须触发通知
    if (lastStateKey !== null) fireTransition(st);
    lastStateKey = key;
    setQuote(st);
    recordTodayStats();
  }
  // 兜底：每 60 秒落一次盘，保留进行中块的进度（中途退出应用也不丢）
  if (Date.now() - lastStatsWrite >= 60000) {
    lastStatsWrite = Date.now();
    recordTodayStats();
  }
  maybeAutoOpenSummary(st);
  renderPhase(st);
  renderStats();
  refreshStatsPanelIfStale();
  if (currentFillEl) {
    const b = currentFillEl.block;
    const total = b.effEnd - b.start;
    currentFillEl.el.style.width = (total > 0 ? Math.min(100, ((nowSeconds() - b.start) / total) * 100) : 100) + '%';
  }
  updateTray(st);
}
