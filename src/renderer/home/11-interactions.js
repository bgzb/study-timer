/* ==================== 交互动作 ==================== */

$('#requoteBtn').addEventListener('click', () => {
  setQuote(currentState(day));
});

/* 跳过当前块：先填写理由再生效，理由随跳过记录一起入档当日总结 */
const skipReasonOverlay = $('#skipReasonOverlay');

function updateSkipConfirm() {
  $('#skipConfirm').disabled = !$('#skipReasonInput').value.trim();
}
function openSkipReason(st) {
  $('#skipReasonTarget').textContent =
    (st.block.type === 'study' ? t('studyWord') : t('breakWord'))
    + ' · ' + fmtClock(st.block.start) + ' – ' + fmtClock(st.block.end);
  const nb = day.blocks.find((b) => b.start >= st.block.end);
  $('#skipReasonHint').textContent = nb
    ? t('skipNextHint')(nb.type === 'study' ? t('studyWord') : t('breakWord'), fmtClock(nb.start))
    : t('skipEndHint');
  const input = $('#skipReasonInput');
  input.value = '';
  updateSkipConfirm();
  skipReasonOverlay.classList.add('open');
  scheduleBarResize();
  setTimeout(() => input.focus(), 50);
}
function closeSkipReason() {
  skipReasonOverlay.classList.remove('open');
  scheduleBarResize();
}

/* 当天专属临时学习时段 */
const extraOverlay = $('#extraOverlay');
const extraTitleInput = $('#extraTitleInput');
const extraStartInput = $('#extraStartInput');
const extraEndInput = $('#extraEndInput');
const extraError = $('#extraError');
function extraMinutes(value) { return clockMinutes(value); }
function extraIntervalsForToday(extras) {
  const intervals = [];
  // 收工生效中：收工点之前的计划时段仍占用，之后的计划时段已从当天剔除，可自由加钟
  const wd = windDownActiveOf(today.str);
  const wdMin = wd ? Math.floor(wd.at / 60) : null;
  const sessions = state.schedules[modeInfo.mode] || [];
  sessions.forEach((s) => {
    const start = clockMinutes(s.start), duration = (s.seq || []).reduce((a, n) => a + Number(n || 0), 0);
    if (!Number.isFinite(start) || duration <= 0) return;
    if (wdMin != null && start >= wdMin) return;
    intervals.push({ start, end: wdMin != null ? Math.min(start + duration, wdMin) : start + duration });
  });
  (extras || []).forEach((x) => {
    const start = clockMinutes(x.start), end = clockMinutes(x.end);
    if (Number.isFinite(start) && Number.isFinite(end) && start < end) intervals.push({ start, end });
  });
  return intervals;
}
function extraOverlap(start, end, extras) {
  return extraIntervalsForToday(extras).some((x) => start < x.end && end > x.start);
}
function validateExtra(startText, endText, extras) {
  const start = extraMinutes(startText), end = extraMinutes(endText);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return t('extraBadTime');
  if (start >= end) return t('extraInvalidRange');
  if (extraOverlap(start, end, extras)) return t('extraOverlap');
  return '';
}
function nextOccupiedStart(start) {
  const occupied = extraIntervalsForToday((state.extra || {})[today.str] || []);
  const next = occupied.filter((x) => x.start > start).sort((a, b) => a.start - b.start)[0];
  return next ? next.start : 23 * 60 + 59;
}
function renderExtraList() {
  const list = $('#extraList');
  list.innerHTML = '';
  const extras = ((state.extra || {})[today.str] || []).slice().sort((a, b) => clockMinutes(a.start) - clockMinutes(b.start));
  if (!extras.length) { list.innerHTML = '<div id="extraEmpty">' + esc(t('extraEmpty')) + '</div>'; return; }
  extras.forEach((x) => {
    const row = document.createElement('div'); row.className = 'extraItem';
    const info = document.createElement('span'); info.className = 'info';
    info.textContent = (x.title || t('extraTitle')) + ' · ' + x.start + '–' + x.end;
    const del = document.createElement('button'); del.type = 'button'; del.innerHTML = iconSvg('delete', { size: 16 }); del.title = t('extraDeleted'); del.setAttribute('aria-label', t('extraDeleted'));
    del.addEventListener('click', () => {
      const latest = loadState();
      state = latest;
      state.extra = state.extra || {};
      const current = (state.extra[today.str] || []).filter((y) => String(y.id) !== String(x.id));
      if (current.length) state.extra[today.str] = current; else delete state.extra[today.str];
      saveState(); rebuildDay(); recordTodayStats(); tick(); renderExtraList();
    });
    row.appendChild(info); row.appendChild(del); list.appendChild(row);
  });
}
function updateExtraError() {
  extraError.textContent = validateExtra(extraStartInput.value, extraEndInput.value, ((state.extra || {})[today.str] || []));
}
function openExtra() {
  const now = new Date();
  const start = now.getHours() * 60 + now.getMinutes();
  let end = Math.min(start + 40, nextOccupiedStart(start));
  if (end <= start) end = Math.min(start + 40, 23 * 60 + 59);
  extraTitleInput.value = '';
  extraStartInput.value = fmtClock(start * 60);
  extraEndInput.value = fmtClock(end * 60);
  extraError.textContent = '';
  renderExtraList();
  extraOverlay.classList.add('open'); scheduleBarResize();
  setTimeout(() => extraTitleInput.focus(), 50);
}
function closeExtra() { extraOverlay.classList.remove('open'); scheduleBarResize(); }
function newExtraId() {
  const used = new Set(((state.extra || {})[today.str] || []).map((x) => String(x.id)));
  let id;
  do { id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8); } while (used.has(id));
  return id;
}
$('#extraBtn').addEventListener('click', openExtra);
$('#closeExtra').addEventListener('click', closeExtra);
$('#extraCancel').addEventListener('click', closeExtra);
extraOverlay.addEventListener('click', (e) => { if (e.target === extraOverlay) closeExtra(); });
[extraStartInput, extraEndInput].forEach((el) => el.addEventListener('input', updateExtraError));
$('#extraQuick').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-min]'); if (!btn) return;
  const start = extraMinutes(extraStartInput.value); if (!Number.isFinite(start)) return;
  let end = Math.min(start + Number(btn.dataset.min), nextOccupiedStart(start));
  if (end <= start) end = Math.min(start + Number(btn.dataset.min), 23 * 60 + 59);
  extraEndInput.value = fmtClock(end * 60); updateExtraError();
});
$('#extraConfirm').addEventListener('click', () => {
  // 确认前重读共享状态，避免时间块窗口的保存覆盖其他窗口刚写入的加钟
  state = loadState();
  rebuildDay();
  const start = extraMinutes(extraStartInput.value), end = extraMinutes(extraEndInput.value);
  const extras = ((state.extra || {})[today.str] || []).slice();
  const err = validateExtra(extraStartInput.value, extraEndInput.value, extras);
  if (err) { extraError.textContent = err; return; }
  const item = { id: newExtraId(), title: extraTitleInput.value.trim() || t('extraTitle'), start: fmtClock(start * 60), end: fmtClock(end * 60) };
  if (!state.extra) state.extra = {};
  state.extra[today.str] = extras.concat(item).sort((a, b) => clockMinutes(a.start) - clockMinutes(b.start));
  saveState(); rebuildDay(); recordTodayStats(); tick(); renderExtraList();
  extraTitleInput.value = ''; extraError.textContent = '';
});

/* 批量收工（阶梯休息券用）：把今天所有未结束的学习块标记为跳过。
   进行中的块截到当前时刻，未来块整块跳过（at = 原定开始，贡献 0 分钟）；
   已有跳过记录的块幂等跳过。返回写入条数（0 = 没有剩余学习块）。 */
function skipRemainingStudyBlocks(reason) {
  if (!state.skips) state.skips = {};
  const list = state.skips[today.str] || (state.skips[today.str] = []);
  const now = nowSeconds();
  let n = 0;
  for (const b of day.blocks) {
    if (b.type !== 'study' || b.effEnd <= now) continue;
    if (list.find((x) => x.key === b.key)) continue;
    list.push({
      key: b.key, at: Math.max(b.start, now), reason,
      type: b.type, start: b.start, end: b.end,
    });
    n++;
  }
  if (n) { rebuildDay(); recordTodayStats(); }
  return n;
}

/* 跳过动作 */
$('#skipBtn').addEventListener('click', () => {
  const st = currentState(day);
  if (st.phase !== 'study' && st.phase !== 'break') return;
  openSkipReason(st);
});
$('#closeSkipReason').addEventListener('click', closeSkipReason);
$('#skipCancel').addEventListener('click', closeSkipReason);
skipReasonOverlay.addEventListener('click', (e) => { if (e.target === skipReasonOverlay) closeSkipReason(); });
$('#skipQuick').addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;
  const input = $('#skipReasonInput');
  input.value = btn.textContent;
  updateSkipConfirm();
  input.focus();
});
$('#skipReasonInput').addEventListener('input', updateSkipConfirm);
$('#skipReasonInput').addEventListener('keydown', (e) => {
  // Enter 确认（Shift+Enter 换行），与总结窗口的表单手感一致
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    if (!$('#skipConfirm').disabled) $('#skipConfirm').click();
  }
});
$('#skipConfirm').addEventListener('click', () => {
  const reason = $('#skipReasonInput').value.trim();
  if (!reason) return;
  // 弹窗开着时块可能已自然结束或被其它窗口跳过，确认前重新校验
  const st = currentState(day);
  if (st.phase !== 'study' && st.phase !== 'break') { closeSkipReason(); return; }
  if (!state.skips[today.str]) state.skips[today.str] = [];
  if (!state.skips[today.str].find((x) => x.key === st.block.key)) {
    // type/start/end 为该块快照：日后修改作息也不影响总结里的跳过记录
    state.skips[today.str].push({
      key: st.block.key, at: nowSeconds(), reason,
      type: st.block.type, start: st.block.start, end: st.block.end,
    });
    saveState();
    rebuildDay();
    recordTodayStats();
    tick();
  }
  closeSkipReason();
});

/* 收工：提前结束今天——已学时间照常记录，剩余计划时段不计应完成、不标跳过；收工后仍可加钟。
   按钮双态（文案由 renderStats 维护）：未收工弹确认层；收工生效中点击即撤销 */
const windDownOverlay = $('#windDownOverlay');
function openWindDown() {
  windDownOverlay.classList.add('open');
  scheduleBarResize();
}
function closeWindDown() {
  windDownOverlay.classList.remove('open');
  scheduleBarResize();
}
$('#windDownBtn').addEventListener('click', () => {
  if (!windDownActiveOf(today.str)) { openWindDown(); return; }
  // 撤销收工：保留记录（区间 [at, undoneAt) 从统计剔除），原日程从当前时刻起照常流转
  state = loadState();
  const last = windDownList(today.str)[windDownList(today.str).length - 1];
  if (!last) return;
  last.undoneAt = nowSeconds();
  saveState(); rebuildDay(); recordTodayStats(); tick();
});
$('#closeWindDown').addEventListener('click', closeWindDown);
$('#windDownCancel').addEventListener('click', closeWindDown);
windDownOverlay.addEventListener('click', (e) => { if (e.target === windDownOverlay) closeWindDown(); });
$('#windDownConfirm').addEventListener('click', () => {
  // 弹层开着时日程可能已自然结束，确认前重新校验
  if (currentState(day).phase === 'done') { closeWindDown(); return; }
  if (!state.windDown) state.windDown = {};
  const list = state.windDown[today.str] || (state.windDown[today.str] = []);
  const last = list[list.length - 1];
  if (!last || last.undoneAt != null) list.push({ at: nowSeconds() });
  saveState(); rebuildDay(); recordTodayStats(); tick();
  closeWindDown();
});

if (!BAR_MODE) {
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    // 按层级从上往下收：先弹层，再侧边抽屉
    if (extraOverlay.classList.contains('open')) { closeExtra(); return; }
    if (skipReasonOverlay.classList.contains('open')) { closeSkipReason(); return; }
    if (windDownOverlay.classList.contains('open')) { closeWindDown(); return; }
    if (todoOverlay.classList.contains('open')) { closeTodoPanel(); return; }
    if (cdOverlay.classList.contains('open')) { closeCountdownPanel(); return; }
    closeDrawer();
  });
}

/* 侧边工具抽屉（开合交互与条目动作见 17-tool-drawer.js） */

/* 模式覆盖弹层 */
const modeBadge = $('#modeBadge');
const modePopover = $('#modePopover');
modeBadge.addEventListener('click', (e) => {
  e.stopPropagation();
  const r = modeBadge.getBoundingClientRect();
  modePopover.style.left = r.left + 'px';
  modePopover.style.top = (r.bottom + 6) + 'px';
  modePopover.style.display = 'block';
});
document.addEventListener('click', (e) => {
  if (!modePopover.contains(e.target) && e.target !== modeBadge) modePopover.style.display = 'none';
});
modePopover.addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-mode]');
  if (!btn) return;
  const mode = btn.dataset.mode;
  if (mode) state.override[today.str] = mode;
  else delete state.override[today.str];
  saveState();
  modePopover.style.display = 'none';
  rebuildDay();
  recordTodayStats(); // 切换模式后立即按新作息落盘今天的轨迹
  tick();
});
