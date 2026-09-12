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
function expandDay(sessions, skips, windDownAt) { return StudyTimerShared.expandDay(sessions, skips, windDownAt); }

/* 收工记录（state.windDown['YYYY-MM-DD'] = [{ at, undoneAt? }]）：
   activeAt = 生效中收工的时刻（末项无 undoneAt），传给 expandDay 做块剔除/截断；
   lastRecord = 最后一条（含已撤销），随 dailyStats 落盘供总结页展示 */
function windDownList(dateStr) { return (state.windDown || {})[dateStr] || []; }
function windDownActiveOf(dateStr) { const list = windDownList(dateStr); const last = list[list.length - 1]; return last && last.undoneAt == null ? last : null; }
function windDownLastOf(dateStr) { const list = windDownList(dateStr); return list[list.length - 1] || null; }

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
  return StudyTimerShared.computeStats(day, edits, nowAt != null ? nowAt : nowSeconds(), today.str, StudyTimerShared.countFromOf(state, today.str), windDownList(today.str));
}

/* 打卡门禁：当天起算秒（未打卡 → DAY_END，整天不计） */
function countFromToday() { return StudyTimerShared.countFromOf(state, today.str); }
function gateActiveToday() { return StudyTimerShared.gateActive(state, today.str); }

/* 每日轨迹快照：幂等重算"今天到目前为止"并覆盖写入（重启/崩溃不会重复计数）。
   只在职责窗口调用——菜单栏端常驻负责，桌面端在其未运行时兜底，避免双写。
   未打卡（门禁中）整天不写入：休息日不打卡就完全不计。
   块剔除/截断/撤销区间由 shared snapshot 统一处理（与总结页同源），另附收工记录供展示 */
function recordTodayStats(nowAt) {
  if (!dutiesOwner()) return;
  if (gateActiveToday()) return;
  const snap = StudyTimerShared.snapshot(day, state, nowAt != null ? nowAt : nowSeconds(), today.str, countFromToday(), windDownList(today.str));
  if (!state.dailyStats) state.dailyStats = {};
  state.dailyStats[today.str] = Object.assign(snap, { wd: windDownLastOf(today.str) || undefined });
  saveState();
}

function stateKeyOf(st) {
  if (st.phase === 'study' || st.phase === 'break') return 'b' + st.block.key;
  if (st.phase === 'gap') return 'g' + st.next.key;
  if (st.phase === 'wait') return 'w' + (st.next.key !== undefined ? st.next.key : st.next.idx);
  return 'done';
}
