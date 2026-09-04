/* ==================== 学习统计面板（控制器） ==================== */
/* 五视图（总览/趋势/热力/洞察/成就）+ 日详情/报告滑入层。
   视图渲染在 13-stats-views.js / 13-stats-awards.js；本文件负责：
   分发、进出场与图表动画、自定义 tooltip、事件路由、防抖刷新。
   对外保留 openStats / closeStatsPanel / renderStatsPanel / refreshStatsPanelIfStale。 */

const statsOverlay = $('#statsOverlay');
const STATS_RANGES = ['overview', 'trend', 'heat', 'insights', 'awards'];
let statsRange = 'overview';
let lastPanelFocus = -1;
let lastRangeIdx = 0;

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
  const r = StudyTimerShared.streaksOf(state.dailyStats || {}, today.str);
  return { cur: r.cur, best: r.best };
}
/* i18n 函数键便捷取值：t 只回原始值，这里把模板函数直接执行 */
function tf(key) {
  const v = t(key);
  return typeof v === 'function' ? v.apply(null, Array.prototype.slice.call(arguments, 1)) : v;
}
/* 防抖静默刷新时跳过动画：图表高度/宽度直接内联，不挂 data-h 延迟设值 */
function stIsQuiet() {
  return $('#statsBody').classList.contains('quiet');
}
function stHAttr(pct) {
  return stIsQuiet() ? ' style="height:' + pct + '%"' : ' data-h="' + pct + '"';
}
function stWAttr(pct) {
  return stIsQuiet() ? ' style="width:' + pct + '%"' : ' data-w="' + pct + '"';
}

function statsViewHtml() {
  if (statsRange === 'trend') return renderTrendView();
  if (statsRange === 'heat') return renderHeatView();
  if (statsRange === 'insights') return renderInsightsView();
  if (statsRange === 'awards') return renderAwardsView();
  return renderOverviewView();
}

function renderStatsPanel(opts) {
  if (!statsOverlay.classList.contains('open')) return;
  const quiet = !!(opts && opts.quiet);
  const st = dayStatOf(today.str);
  lastPanelFocus = st ? st.focusMin : -1;
  const streak = calcStreak();
  const bal = StudyTimerShared.pointsBalance(state.dailyStats, state.points);
  // 头部 chips：连续天数 + 积分余额
  const streakChip = $('#stStreakChip');
  if (streakChip) {
    streakChip.innerHTML = iconSvg('flame', { size: 14 }) + '<b>' + streak.cur + '</b><span class="k">' + t('dayUnit') + '</span>';
    streakChip.dataset.tip = '<div class="tt-k">' + escHtml(tf('streakTip', streak.cur, streak.best)) + '</div>';
  }
  const ptsChip = $('#stPtsChip');
  if (ptsChip) {
    ptsChip.innerHTML = iconSvg('gift', { size: 14 }) + '<b class="cu" data-to="' + bal.balance + '">0</b><span class="k">' + t('ptsUnit') + '</span>';
    ptsChip.dataset.tip = '<div class="tt-k">' + escHtml(t('ptsBalance')) + '</div><div class="tt-s">' + escHtml(t('ptsRule')) + '</div>';
  }
  const body = $('#statsBody');
  const scrollTop = quiet ? body.scrollTop : 0;
  body.classList.toggle('quiet', quiet);
  const idx = STATS_RANGES.indexOf(statsRange);
  const dir = idx >= lastRangeIdx ? 'to-left' : 'to-right';
  body.innerHTML = '<div class="stView ' + (quiet ? '' : dir) + '">' + statsViewHtml() + '</div>';
  body.scrollTop = scrollTop;
  lastRangeIdx = idx;
  if (quiet) {
    // 静默刷新：数字直接落定，不播任何动画
    body.querySelectorAll('.cu[data-to]').forEach((el) => { el.textContent = el.dataset.to || '0'; });
    const pc = ptsChip && ptsChip.querySelector('.cu');
    if (pc) pc.textContent = pc.dataset.to || '0';
  } else {
    requestAnimationFrame(() => {
      stAnimateIn(body);
      if (ptsChip) { const pc = ptsChip.querySelector('.cu'); if (pc) stCountUp(pc); }
    });
  }
  stSyncSegDot();
}

/* ---------- 进场动画编排：柱生长 / 进度条 / count-up / 滚动定位 ---------- */
function stAnimateIn(root) {
  // 柱状生长：先以 height:0 入文档，双 rAF 后设目标高度，按索引错峰
  root.querySelectorAll('.stFill[data-h], .stBars .bar[data-h], .stTypeCol .bar[data-h], .stMiniBars .mb[data-h]').forEach((el, i) => {
    el.style.transitionDelay = Math.min(i * 18, 400) + 'ms';
  });
  root.querySelectorAll('.stActItem .fill[data-w], .stReasonRow .bar[data-w]').forEach((el, i) => {
    el.style.transitionDelay = Math.min(i * 40, 400) + 'ms';
  });
  requestAnimationFrame(() => requestAnimationFrame(() => {
    root.querySelectorAll('.stFill[data-h], .stBars .bar[data-h], .stTypeCol .bar[data-h], .stMiniBars .mb[data-h]').forEach((el) => {
      el.style.height = el.dataset.h + '%';
    });
    root.querySelectorAll('.stActItem .fill[data-w], .stReasonRow .bar[data-w]').forEach((el) => {
      el.style.width = el.dataset.w + '%';
    });
    // 全年热力图滚动到本周
    const scroll = root.querySelector('.stHeatScroll');
    const todayCell = root.querySelector('.stYCell.today, .stYCell.l1, .stYCell.l2, .stYCell.l3, .stYCell.l4');
    if (scroll) {
      const anchorCell = root.querySelector('.stYCell.today') || todayCell;
      if (anchorCell) scroll.scrollLeft = Math.max(0, anchorCell.offsetLeft - scroll.clientWidth * 0.6);
    }
  }));
  root.querySelectorAll('.cu[data-to]').forEach((el) => stCountUp(el));
}

function stReducedMotion() {
  return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
function stCountUp(el) {
  const to = Number(el.dataset.to) || 0;
  const dur = 650;
  if ($('#statsBody').classList.contains('quiet') || stReducedMotion()) { el.textContent = String(to); return; }
  const t0 = performance.now();
  const step = (now) => {
    const p = Math.min(1, (now - t0) / dur);
    const eased = 1 - Math.pow(1 - p, 3);
    el.textContent = String(Math.round(to * eased));
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/* 成就分段红点：有本次会话新解锁且尚未看过成就页时提示 */
function stSyncSegDot() {
  const btn = $('#statsSeg button[data-range="awards"]');
  if (btn) btn.classList.toggle('has-new', typeof stHasFreshUnlocks === 'function' && stHasFreshUnlocks());
}

// 面板打开期间只在"今日"专注分钟数实际变化时静默重建总览视图：
// 每秒全量重绘会打断悬停提示与动画；其余视图打开期间不实时刷新
function refreshStatsPanelIfStale() {
  if (!statsOverlay.classList.contains('open')) return;
  const st = dayStatOf(today.str);
  const f = st ? st.focusMin : 0;
  if (statsRange === 'overview' && f !== lastPanelFocus) {
    if (typeof syncAchievements === 'function' && syncAchievements().length) {
      renderStatsPanel(); // 刚解锁成就 → 带动画重绘
      return;
    }
    renderStatsPanel({ quiet: true });
  }
}

function openStats() {
  if (typeof syncAchievements === 'function') syncAchievements();
  statsOverlay.classList.add('open');
  renderStatsPanel();
  scheduleBarResize();
}
function closeStatsPanel() {
  if (typeof closeStatsLayer === 'function') closeStatsLayer();
  statsOverlay.classList.remove('open');
  scheduleBarResize();
}

/* ---------- 自定义 tooltip（替换原生 title） ---------- */
const stTip = $('#statsTip');
function stTipHide() {
  if (stTip) stTip.classList.remove('show');
}
function stTipMove(e) {
  if (!stTip) return;
  const rect = stTip.getBoundingClientRect();
  // 先按光标所在侧翻转，再把两个坐标统一限制在视口内；超宽/超高 tooltip 也不得产生负上限。
  let x = e.clientX + 14, y = e.clientY - rect.height - 10;
  if (x + rect.width > window.innerWidth - 8) x = e.clientX - rect.width - 14;
  if (y < 8) y = e.clientY + 16;
  const maxX = Math.max(8, window.innerWidth - rect.width - 8);
  const maxY = Math.max(8, window.innerHeight - rect.height - 8);
  x = Math.max(8, Math.min(x, maxX));
  y = Math.max(8, Math.min(y, maxY));
  stTip.style.left = x + 'px';
  stTip.style.top = y + 'px';
}
statsOverlay.addEventListener('mousemove', (e) => {
  const el = e.target.closest ? e.target.closest('[data-tip], .stc-rc-bar, .stc-sc-dot') : null;
  const tipHtml = el && statsOverlay.contains(el) ? (el.dataset.tip || (typeof stDynamicTip === 'function' ? stDynamicTip(el) : '')) : '';
  if (el && tipHtml) {
    stTip.innerHTML = tipHtml;
    stTip.classList.add('show');
    stTipMove(e);
  } else stTipHide();
});
statsOverlay.addEventListener('mouseleave', stTipHide);
statsOverlay.addEventListener('scroll', stTipHide, true);

/* ---------- 事件路由：视图内交互统一走 data-act ---------- */
function statsAction(act, el, e) {
  switch (act) {
    case 'day':
      if (el.dataset.date) openStatsDayLayer(el.dataset.date);
      return true;
    case 'goto-awards':
      statsSwitchRange('awards');
      return true;
    case 'goal-edit':
    case 'goal-set':
    case 'trend-kind':
    case 'trend-prev':
    case 'trend-next':
    case 'trend-month':
    case 'heat-prev':
    case 'heat-next':
    case 'ins-range':
    case 'reward-add':
    case 'reward-del':
    case 'reward-redeem':
    case 'rest-redeem':
    case 'report':
    case 'j-view':
    case 'layer-back':
    case 'layer-edit-day':
    case 'report-copy':
      return typeof statsViewAction === 'function' ? statsViewAction(act, el, e) : false;
    default:
      return false;
  }
}
function statsSwitchRange(range) {
  statsRange = range;
  document.querySelectorAll('#statsSeg button').forEach((b) => b.classList.toggle('active', b.dataset.range === range));
  renderStatsPanel();
}
// 打开入口在侧边抽屉（17-tool-drawer.js 的 DRAWER_ACTIONS.stats）
$('#closeStats').addEventListener('click', () => { closeStatsPanel(); });
statsOverlay.addEventListener('click', (e) => {
  if (e.target === statsOverlay) closeStatsPanel();
});
$('#statsSeg').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-range]');
  if (!btn) return;
  statsSwitchRange(btn.dataset.range);
});
function onStatsActionEvent(e) {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  if (statsAction(el.dataset.act, el, e)) e.stopPropagation();
}
$('#statsBody').addEventListener('click', onStatsActionEvent);
$('#statsLayerBody').addEventListener('click', onStatsActionEvent);
$('#statsLayerHead').addEventListener('click', onStatsActionEvent);
$('#statsHead').addEventListener('click', onStatsActionEvent);
// 奖励表单回车提交
$('#statsBody').addEventListener('keydown', (e) => {
  if (e.key !== 'Enter') return;
  const el = e.target.closest('#stRewardName, #stRewardCost');
  if (el) statsAction('reward-add', el, e);
});

// ←/→ 切换视图（滑入层打开或聚焦输入时不响应）
document.addEventListener('keydown', (e) => {
  if (!statsOverlay.classList.contains('open')) return;
  if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
  if (document.activeElement && document.activeElement.closest('input,textarea,select')) return;
  if ($('#statsLayer').classList.contains('open')) return;
  const idx = STATS_RANGES.indexOf(statsRange);
  const next = e.key === 'ArrowRight' ? idx + 1 : idx - 1;
  if (next >= 0 && next < STATS_RANGES.length) statsSwitchRange(STATS_RANGES[next]);
});
