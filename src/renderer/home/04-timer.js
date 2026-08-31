/* ==================== 计时引擎 ==================== */

function detectMode(today) {
  const ov = state.override[today.str];
  if (ov) return { mode: ov, manual: true };
  const mk = state.makeup[today.str];
  if (mk) return { mode: 'workday', note: mk + ' · 补班' };
  const hol = state.holidays[today.str];
  if (hol) return { mode: 'holiday', note: hol };
  if (today.dow === 0 || today.dow === 6) return { mode: 'weekend' };
  return { mode: 'workday' };
}

/* 块时刻恒为计划值；跳过只把该块截到跳过点（effEnd），剩余时间成为间隙——
   后续块仍从原定时刻开始，不再整体提前 */
function clockMinutes(value) { return StudyTimerShared.clockMinutes(value); }
function extraSessionOf(x) { return StudyTimerShared.extraSessionOf(x, t('extraTitle')); }
function normalizeExtraData(data) { return StudyTimerShared.normalizeExtraData(data); }
function mergeExtraSessions(sessions, extras) { return StudyTimerShared.mergeExtraSessions(sessions, extras, t('extraTitle')); }
function expandDay(sessions, skips) { return StudyTimerShared.expandDay(sessions, skips); }

function currentState(day) { return StudyTimerShared.currentState(day, nowSeconds); }

/* 时间块编辑（day.html 写入）：key -> { act, note, focus }。
   focus 未显式覆盖时按原类型（学习算、休息不算）；覆盖后专注时长随之增减 */
function blockEditOf(b, dateStr) {
  return ((state.blocks || {})[dateStr] || {})[b.key] || null;
}
function focusFlagOf(b, dateStr) {
  const ed = blockEditOf(b, dateStr);
  return ed && ed.focus !== undefined ? !!ed.focus : b.type === 'study';
}

function computeStats(day, nowAt) {
  const edits = ((state.blocks || {})[today.str]) || {};
  return StudyTimerShared.computeStats(day, edits, nowAt != null ? nowAt : nowSeconds(), today.str);
}

/* 每日轨迹快照：幂等重算"今天到目前为止"并覆盖写入（重启/崩溃不会重复计数）。
   只在职责窗口调用——菜单栏端常驻负责，桌面端在其未运行时兜底，避免双写。 */
function recordTodayStats(nowAt) {
  if (!dutiesOwner()) return;
  const now = nowAt != null ? nowAt : nowSeconds();
  const stats = computeStats(day, nowAt);
  const skips = (state.skips && state.skips[today.str]) || [];
  const blocks = [];
  let skipped = 0;
  for (const b of day.blocks) {
    if (b.type !== 'study' || b.effEnd > now) continue;
    const sk = b.effEnd < b.end;
    if (sk) skipped++;
    const sr = sk ? skips.find((x) => x.key === b.key) : null;
    const ed = blockEditOf(b, today.str);
    blocks.push({
      s: b.start, e: b.effEnd, min: Math.round(((b.effEnd - b.start) / 60) * 10) / 10,
      sk: sk || undefined, r: (sr && sr.reason) || undefined,
      act: (ed && ed.act) || undefined, note: (ed && ed.note) || undefined,
      f: ed && ed.focus === false ? false : undefined,
    });
  }
  if (!state.dailyStats) state.dailyStats = {};
  state.dailyStats[today.str] = { focusMin: stats.focusMin, done: stats.done, total: stats.total, skipped, blocks };
  saveState();
}

function stateKeyOf(st) {
  if (st.phase === 'study' || st.phase === 'break') return 'b' + st.block.key;
  if (st.phase === 'gap') return 'g' + st.next.key;
  if (st.phase === 'wait') return 'w' + (st.next.key !== undefined ? st.next.key : st.next.idx);
  return 'done';
}
