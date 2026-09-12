/* ==================== 倒数日 ==================== */
/* D-day 管理：增删 + 托盘标题后缀开关（cdTray）。数据存共享 state.countdowns，
   天数计算与排序在 shared/countdown-model.js（纯函数，领域测试覆盖）。
   打开入口在侧边抽屉（17-tool-drawer.js 的 DRAWER_ACTIONS.countdown）。 */

const cdOverlay = $('#cdOverlay');
let cdSig = null;

function cdDayChip(c) {
  const cls = c.state === 'past' ? 'past' : (c.state === 'today' ? 'today' : '');
  const txt = c.state === 'today' ? t('cdToday')
    : (c.state === 'past' ? t('cdPassed')(-c.days) : t('cdLeft')(c.days));
  return '<span class="cd-chip ' + cls + '">' + escHtml(txt) + '</span>';
}

function renderCountdownPanel() {
  if (!cdOverlay.classList.contains('open')) return;
  const list = StudyTimerShared.sortedCountdowns(state.countdowns, today.str);
  $('#cdList').innerHTML = list.length
    ? list.map((c) => '<div class="cdRow' + (c.state === 'past' ? ' past' : '') + '" data-id="' + c.id + '">'
      + '<div class="cd-main"><div class="cd-name">' + escHtml(c.name) + '</div>'
      + '<div class="cd-date">' + escHtml(c.date) + '</div></div>'
      + cdDayChip(c)
      + '<button class="cd-del" aria-label="' + t('delRow') + '">' + iconSvg('close', { size: 13 }) + '</button>'
      + '</div>').join('')
    : '<div class="jEmpty">' + t('cdEmpty') + '</div>';
  $('#cdTraySwitch').checked = !!state.cdTray;
  $('#cdHomeSwitch').checked = !!state.cdHome;
  cdSig = JSON.stringify([state.countdowns || [], state.cdTray, state.cdHome]);
}

function openCountdownPanel() {
  cdOverlay.classList.add('open');
  renderCountdownPanel();
  scheduleBarResize();
}
function closeCountdownPanel() {
  cdOverlay.classList.remove('open');
  scheduleBarResize();
}

function refreshCountdownIfChanged() {
  if (!cdOverlay.classList.contains('open')) { cdSig = null; return; }
  const sig = JSON.stringify([state.countdowns || [], state.cdTray, state.cdHome]);
  if (sig === cdSig) return;
  renderCountdownPanel();
}

function addCountdown() {
  const nameEl = $('#cdName'), dateEl = $('#cdDate');
  const errEl = $('#cdErr');
  const name = nameEl.value.trim();
  const date = dateEl.value;
  const dup = (state.countdowns || []).some((c) => c && c.name === name);
  if (!name) { errEl.textContent = t('cdErrName'); nameEl.focus(); return; }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || isNaN(StudyTimerShared.daysUntil(date, today.str))) {
    errEl.textContent = t('cdErrDate'); dateEl.focus(); return;
  }
  if (dup) { errEl.textContent = t('cdErrDup'); nameEl.focus(); return; }
  errEl.textContent = '';
  if (!Array.isArray(state.countdowns)) state.countdowns = [];
  state.countdowns.push({ id: 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name, date });
  nameEl.value = '';
  saveState();
  renderCountdownPanel();
  tick(); // 托盘后缀可能变化
}

$('#closeCd').addEventListener('click', closeCountdownPanel);
cdOverlay.addEventListener('click', (e) => { if (e.target === cdOverlay) closeCountdownPanel(); });
$('#cdAddBtn').addEventListener('click', addCountdown);
$('#cdName').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addCountdown(); } });
$('#cdTraySwitch').addEventListener('change', (e) => {
  state.cdTray = e.target.checked;
  saveState();
  renderCountdownPanel();
  tick(); // 托盘标题立即生效
});
$('#cdHomeSwitch').addEventListener('change', (e) => {
  state.cdHome = e.target.checked;
  saveState();
  renderCountdownPanel();
  renderCdHomeChip();
});
$('#cdList').addEventListener('click', (e) => {
  const row = e.target.closest('.cdRow');
  if (!row || !row.dataset.id) return;
  if (!e.target.closest('.cd-del')) return;
  state.countdowns = (state.countdowns || []).filter((c) => c.id !== row.dataset.id);
  saveState();
  renderCountdownPanel();
  tick();
});

/* ==================== 主页倒数徽标 ==================== */
/* cdHome 开启且存在未到期项时，主页顶栏显示「⏳ 名称 剩余天数」徽标，
   点击打开倒数日面板。文本带签名缓存，tick 每秒调用也不重复写 DOM。 */

const cdHomeChip = $('#cdHomeChip');
let cdChipSig = null;

function renderCdHomeChip() {
  if (!cdHomeChip) return;
  const near = StudyTimerShared.sortedCountdowns(state.countdowns, today.str).find((c) => c.days >= 0) || null;
  const text = near
    ? '⏳ ' + near.name + ' ' + (near.days === 0 ? t('cdToday') : near.days + t('dayUnit'))
    : null;
  const sig = (state.cdHome ? 'on' : 'off') + '|' + text;
  if (sig === cdChipSig) return;
  cdChipSig = sig;
  if (!state.cdHome || !text) {
    cdHomeChip.classList.add('hidden');
    return;
  }
  cdHomeChip.classList.remove('hidden');
  cdHomeChip.textContent = text;
  cdHomeChip.title = near.days === 0 ? near.name + ' · ' + t('cdToday') : near.name + ' · ' + t('cdLeft')(near.days);
}

cdHomeChip.addEventListener('click', () => {
  if (typeof closeDrawer === 'function') closeDrawer(); // 与抽屉条目同规则：先收抽屉再开面板
  openCountdownPanel();
});

renderCdHomeChip(); // 启动时本文件晚于 16-bootstrap 执行，这里补首次渲染
