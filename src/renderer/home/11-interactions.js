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
  const sessions = state.schedules[modeInfo.mode] || [];
  sessions.forEach((s) => {
    const start = clockMinutes(s.start), duration = (s.seq || []).reduce((a, n) => a + Number(n || 0), 0);
    if (Number.isFinite(start) && duration > 0) intervals.push({ start, end: start + duration });
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
if (!BAR_MODE) {
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    // 按层级从上往下收：先弹层，再侧边抽屉
    if (extraOverlay.classList.contains('open')) { closeExtra(); return; }
    if (skipReasonOverlay.classList.contains('open')) { closeSkipReason(); return; }
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
