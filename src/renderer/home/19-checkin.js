/* ==================== 每日打卡门禁 ==================== */
/* 每天点一次「开始今天」当天才计专注时间；打卡存共享 state（checkins[date]），
   任一端打卡即全局生效。默认从打卡时刻起算，可补记更早时刻。
   门禁语义（未打卡不落盘/不通知/不弹总结）在 04-timer / 06-notifications /
   08-summary / 10-loop 里各自守卫；这里只负责卡片渲染与打卡写入。
   文件在 16-bootstrap 之后加载，tick 里用 typeof 守卫调用 renderCheckinGate。 */

const checkinCard = $('#checkinCard');
const ckBackfillRow = $('#ckBackfillRow');
const ckFromInput = $('#ckFromInput');

function hideCkBackfillRow() {
  ckBackfillRow.classList.add('hidden');
}

/* tick 每秒调用（gated 由调用方算好，省一次重复计算）；也可无参自查 */
function renderCheckinGate(gated) {
  const on = gated != null ? !!gated : gateActiveToday();
  checkinCard.classList.toggle('hidden', !on);
  if (!on) hideCkBackfillRow();
}

/* 打卡：fromSec 为当天起算秒（缺省 = 当前时刻）。写入后立即结算当天轨迹 */
function checkIn(fromSec) {
  const now = nowSeconds();
  const from = Number.isFinite(fromSec) && fromSec >= 0 ? Math.min(86399, Math.floor(fromSec)) : now;
  // 防覆盖确认：今天已有专注记录、而新起算点会让它缩水时，先问一次
  // （升级当天旧数据仍在、或补记时刻晚于已记录时段等场景）
  const recorded = (((state.dailyStats || {})[today.str]) || {}).focusMin || 0;
  if (recorded > 0) {
    const edits = (state.blocks || {})[today.str] || {};
    const prospect = StudyTimerShared.computeStats(day, edits, now, today.str, from, windDownList(today.str)).focusMin;
    if (prospect < recorded) {
      if (!confirm(tf('ckOverwriteConfirm', recorded, prospect, fmtClock(from)))) return;
    }
  }
  if (!state.checkins || typeof state.checkins !== 'object') state.checkins = {};
  state.checkins[today.str] = { at: new Date().toISOString(), from };
  saveState();
  rebuildDay();
  recordTodayStats();
  tick();
}

$('#ckStartBtn').addEventListener('click', () => checkIn());

$('#ckBackfillBtn').addEventListener('click', () => {
  const now = nowSeconds();
  ckFromInput.value = fmtClock(now);
  ckFromInput.max = fmtClock(now); // 只允许选过去时刻（浏览器支持不一，提交时再兜底）
  ckBackfillRow.classList.remove('hidden');
  setTimeout(() => ckFromInput.focus(), 50);
});

$('#ckFromConfirm').addEventListener('click', () => {
  const m = /^(\d{1,2}):(\d{2})/.exec(ckFromInput.value || '');
  if (!m) { ckFromInput.focus(); return; }
  const sec = (Number(m[1]) % 24) * 3600 + Number(m[2]) * 60;
  // 不接受未来时刻：兜底为当前时间（等价于普通打卡）
  checkIn(sec < nowSeconds() ? sec : undefined);
});

ckFromInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); $('#ckFromConfirm').click(); }
});

renderCheckinGate();
