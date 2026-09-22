/* ==================== 统计：成就 / 积分奖励 / 滑入层（日详情·报告） ==================== */
/* 视图动作统一由 statsViewAction 分发（13-stats.js 的 statsAction 转发到这里） */

let stFreshUnlocks = [];   // 本次会话新解锁的成就 id（红点 + 徽章入场高亮）
let stAwardsSeen = false;  // 看过成就页后不再亮红点
let stRedeemFlash = '';    // 刚兑换成功的提示文案（短暂展示后自动消失）
let stLayerMode = null;    // 'day' | 'report'
let stLayerDate = null;    // 日详情层当前日期
let stArmTimer = null;     // 兑换两步确认的复位计时器
let stReportData = null;   // 报告层当前文案（复制用）
const statsLayer = $('#statsLayer');

/* ---------- 成就解锁检测（tick/状态同步/打开面板时调用）：落盘日期、入账积分、发通知 ----------
   首次达成写 unlockedAt 并即时加分；历史已解锁但未入账积分的旧数据在此幂等补发（静默，不发通知） */
function syncAchievements() {
  const fresh = [];
  const list = StudyTimerShared.checkAchievements(state);
  if (!state.achievements || typeof state.achievements !== 'object') state.achievements = { unlockedAt: {}, points: {} };
  if (!state.achievements.unlockedAt || typeof state.achievements.unlockedAt !== 'object') state.achievements.unlockedAt = {};
  if (!state.achievements.points || typeof state.achievements.points !== 'object') state.achievements.points = {};
  let pointsChanged = false;
  for (const a of list) {
    if (a.done && !state.achievements.unlockedAt[a.id]) {
      state.achievements.unlockedAt[a.id] = today.str;
      fresh.push(a.id);
    }
    if ((state.achievements.unlockedAt[a.id] || a.done) && !state.achievements.points[a.id]) {
      state.achievements.points[a.id] = a.pts;
      pointsChanged = true;
    }
  }
  if (fresh.length) {
    stFreshUnlocks = stFreshUnlocks.concat(fresh);
    saveState();
    stNotifyAchievements(fresh, list);
  } else if (pointsChanged) {
    saveState();
  }
  return fresh;
}
/* 成就达成系统通知：单条带条件描述与积分；多条合并为一条报总数。
   与相位通知同约定：只由职责窗口发送（窗口间先落盘者胜，职责窗口每分钟兜底同步） */
function stNotifyAchievements(freshIds, list) {
  if (!dutiesOwner()) return;
  const byId = {};
  list.forEach((a) => { byId[a.id] = a; });
  if (freshIds.length === 1) {
    const a = byId[freshIds[0]];
    notify(tf('achNotifyTitle', t('ach_' + a.id)),
      t('ach_' + a.id + '_d') + tf('achNotifyPts', a.pts), currentSysSound());
  } else {
    const joiner = state.language === 'en' ? ', ' : '、';
    const total = freshIds.reduce((s, id) => s + (byId[id] ? byId[id].pts : 0), 0);
    const names = freshIds.map((id) => '「' + t('ach_' + id) + '」').join(joiner);
    notify(tf('achNotifyTitleN', freshIds.length), names + ' ' + tf('achNotifyPts', total), currentSysSound());
  }
}
function stHasFreshUnlocks() {
  return stFreshUnlocks.length > 0 && !stAwardsSeen;
}

/* ---------- 成就视图 ---------- */
function achIsMinBased(id) { return id.indexOf('total_') === 0 || id.indexOf('day_') === 0; }
function achProgressLabel(a) {
  if (achIsMinBased(a.id)) return fmtMinShort(a.value) + ' / ' + tf('ach_goal_h', Math.round(a.goal / 60));
  if (a.id.indexOf('streak_') === 0) return a.value + '/' + a.goal + ' ' + t('dayUnit');
  return a.value + '/' + a.goal;
}
function renderAwardsView() {
  const SI = StudyTimerShared;
  stAwardsSeen = true;
  const bal = SI.pointsBalance(state.dailyStats, state.points, state.achievements);
  const pts = state.points || {};
  const rewards = Array.isArray(pts.rewards) ? pts.rewards : [];
  const spends = Array.isArray(pts.spends) ? pts.spends : [];

  let html = '';
  if (stRedeemFlash) {
    html += '<div class="stCard full" style="background:var(--break-bg)"><div style="font-size:12.5px;color:var(--break);font-weight:600">' + escHtml(stRedeemFlash) + '</div></div>';
  }

  html += '<div class="stPtsHero">'
    + '<div class="ic">' + iconSvg('gift', { size: 22 }) + '</div>'
    + '<div><div class="v cu" data-to="' + bal.balance + '">0</div><div class="k">' + t('ptsBalance') + ' · ' + t('ptsRule') + '</div></div>'
    + '<div class="sub">' + t('ptsEarned') + ' ' + bal.earned + '<br>' + t('ptsAchEarned') + ' ' + bal.achEarned + '<br>' + t('ptsSpent') + ' ' + bal.spent + '</div>'
    + '</div>';

  html += '<div class="stGrid">';

  // 奖励兑换
  html += '<div class="stCard full"><div class="stCardTitle">' + iconSvg('gift', { size: 13 }) + t('rewardsTitle') + '</div>';
  // 阶梯休息券：系统内置行，价格随本周兑换次数翻倍（周一重置），不在自定义奖励列表里
  const rv = SI.restVoucherState(spends, new Date());
  const canRv = bal.balance >= rv.price;
  html += '<div class="stRewardRow sys" data-tip="' + escHtml(t('restVoucherTip')) + '">'
    + '<span class="nm">' + escHtml(t('restVoucherName')) + '<i class="meta">' + escHtml(tf('restVoucherMeta', rv.count)) + '</i></span>'
    + '<span class="cost">' + rv.price + ' ' + t('ptsUnit') + '</span>'
    + '<div class="ops">'
    + '<button class="stRewardBtn" data-act="rest-redeem"'
    + (canRv ? '' : ' disabled title="' + escHtml(t('rewardInsufficient')) + '"') + '>' + t('rewardRedeem') + '</button>'
    + '</div></div>';
  if (!rewards.length) html += '<div class="stEmptyCard">' + t('rewardEmpty') + '</div>';
  else {
    for (const r of rewards) {
      const can = bal.balance >= r.cost;
      html += '<div class="stRewardRow">'
        + '<span class="nm">' + escHtml(r.name) + '</span>'
        + '<span class="cost">' + r.cost + ' ' + t('ptsUnit') + '</span>'
        + '<div class="ops">'
        + '<button class="stRewardBtn" data-act="reward-redeem" data-id="' + escHtml(r.id) + '"'
        + (can ? '' : ' disabled title="' + escHtml(t('rewardInsufficient')) + '"') + '>' + t('rewardRedeem') + '</button>'
        + '<button class="stDelBtn" data-act="reward-del" data-id="' + escHtml(r.id) + '" aria-label="delete">' + iconSvg('delete', { size: 14 }) + '</button>'
        + '</div></div>';
    }
  }
  html += '<div class="stAddRow">'
    + '<input id="stRewardName" maxlength="20" placeholder="' + escHtml(t('rewardNamePh')) + '">'
    + '<input id="stRewardCost" class="cost" type="number" min="1" max="999999" placeholder="' + escHtml(t('rewardCostPh')) + '">'
    + '<button class="primaryBtn" data-act="reward-add" style="flex-shrink:0">' + t('add') + '</button>'
    + '</div></div>';

  // 兑换记录
  html += '<div class="stCard"><div class="stCardTitle">' + iconSvg('time', { size: 13 }) + t('spendHistory') + '</div>';
  const recent = spends.slice(-6).reverse();
  if (!recent.length) html += '<div class="stEmptyCard">' + t('spendEmpty') + '</div>';
  else {
    for (const s of recent) {
      const d = new Date(s.at);
      const ds = isNaN(d.getTime()) ? '' : (d.getMonth() + 1) + '/' + d.getDate();
      html += '<div class="stSpendRow"><span class="nm">' + escHtml(s.name) + '</span><span class="c">-' + s.cost + '</span><span class="d">' + ds + '</span></div>';
    }
  }
  html += '</div>';

  // 徽章墙（按组）
  const list = SI.checkAchievements(state);
  const unlockedAt = (state.achievements && state.achievements.unlockedAt) || {};
  const unlockedCount = list.filter((a) => a.done || unlockedAt[a.id]).length;
  html += '<div class="stCard full"><div class="stCardTitle">' + iconSvg('star', { size: 13 }) + t('badgesTitle')
    + '<span class="hint">' + unlockedCount + '/' + list.length + '</span></div>';
  for (const g of ['focus', 'streak', 'habit', 'journal', 'extra']) {
    const items = list.filter((a) => a.group === g);
    if (!items.length) continue;
    html += '<div class="stBadgeGroup"><div style="font-size:10.5px;color:var(--text2);letter-spacing:0.06em;margin:10px 0 7px">' + t('achg_' + g) + '</div><div class="stBadges">';
    items.forEach((a, i) => {
      const date = unlockedAt[a.id];
      const done = a.done || !!date;
      const pct = done ? 100 : Math.min(100, Math.round((a.progress / a.goal) * 100));
      // 悬浮提示：名称 / 达成条件描述 / 奖励积分（已达成附达成日期）
      const tip = '<div class="tt-k">' + t('ach_' + a.id) + '</div>'
        + '<div class="tt-d">' + t('ach_' + a.id + '_d') + '</div>'
        + '<div class="tt-s"><span class="tt-p">+' + a.pts + '</span> ' + t('ptsUnit')
        + (done && date ? ' · ' + tf('ach_unlocked_on', date) : '') + '</div>';
      html += '<div class="stBadge' + (done ? '' : ' locked') + (stFreshUnlocks.indexOf(a.id) >= 0 ? ' fresh' : '') + '"'
        + ' style="--d:' + (i * 35) + 'ms" data-tip="' + escHtml(tip) + '">'
        + '<div class="ic">' + iconSvg(a.icon, { size: 17 }) + '</div>'
        + '<div class="nm">' + t('ach_' + a.id) + '</div>'
        + (done
          ? '<div class="dt">' + (date ? date.slice(5).replace('-', '/') : '') + '</div>'
          : '<div class="pr"><i style="width:' + pct + '%"></i></div><div class="stBadgeTip">' + achProgressLabel(a) + '</div>')
        + '</div>';
    });
    html += '</div></div>';
  }
  html += '</div>'; // 徽章卡
  html += '</div>'; // grid
  return html;
}

/* ---------- 滑入层 ---------- */
function openStatsLayer(headHtml) {
  $('#statsLayerHead').innerHTML = headHtml;
  const body = $('#statsLayerBody');
  body.innerHTML = '';
  body.scrollTop = 0;
  statsLayer.classList.add('open');
}
function closeStatsLayer() {
  statsLayer.classList.remove('open');
  stLayerMode = null;
  stLayerDate = null;
  if (typeof stTipHide === 'function') stTipHide();
}
/* Esc 层级链用：滑入层打开时先收它（09-bar.js 调用） */
function dismissStatsLayer() {
  if (statsLayer && statsLayer.classList.contains('open')) { closeStatsLayer(); return true; }
  return false;
}
function stLayerHead(title, sub, rightHtml) {
  return '<button class="stNavBtn" data-act="layer-back" aria-label="back">' + iconSvg('back', { size: 14 }) + '</button>'
    + '<h3>' + title + '</h3>' + (sub ? '<span class="sub">' + sub + '</span>' : '')
    + '<div class="right">' + (rightHtml || '') + '</div>';
}

/* ---------- 日详情层 ---------- */
function openStatsDayLayer(dateStr) {
  stLayerMode = 'day';
  stLayerDate = dateStr;
  const st = dayStatOf(dateStr);
  const j = (state.journal || {})[dateStr];
  const isFuture = dateStr > today.str;
  const mi = detectMode({ str: dateStr, dow: parseDateStr(dateStr).getDay() });
  const modeNames = { workday: t('workday'), weekend: t('weekend'), holiday: t('holiday') };

  openStatsLayer(stLayerHead(stDateLong(dateStr),
    modeNames[mi.mode] + (mi.note ? ' · ' + mi.note : ''),
    '<button class="ghostBtn" data-act="layer-edit-day" data-date="' + dateStr + '">' + iconText('edit', t('editDayBtn')) + '</button>'));

  let html = '';
  if (isFuture) {
    html = '<div class="stEmptyCard">' + t('dlFuture') + '</div>';
  } else {
    html += '<div class="stSummary">'
      + stCell(fmtMinShort(st ? st.focusMin : 0), t('statTotal'))
      + stCell((st ? st.done : 0) + '/' + (st ? st.total : 0), t('statDoneBlocks'))
      + stCell(st ? st.skipped : 0, t('statSkipped'))
      + '</div>';

    // 24 小时时间条：学习块填充，跳过块红显；其下平行一条"应用泳道"（有采集数据时）
    const blocks = (st && st.blocks) || [];
    let strips = '';
    if (blocks.length) {
      let segs = '';
      for (const b of blocks) {
        const l = (b.s / 86400) * 100, w = Math.max(0.3, ((b.e - b.s) / 86400) * 100);
        segs += '<i class="' + (b.sk ? 'sk' : '') + '" style="left:' + l.toFixed(2) + '%;width:' + w.toFixed(2) + '%"></i>';
      }
      const nowMark = dateStr === today.str ? '<div class="now" style="left:' + ((nowSeconds() / 86400) * 100).toFixed(2) + '%"></div>' : '';
      strips += '<div class="stDayStrip" data-tip="' + escHtml(t('todayTimeline')) + '">' + segs + nowMark + '</div>';
    }
    if (typeof stAppStripHtml === 'function') strips += stAppStripHtml(dateStr);
    if (strips) html += strips
      + '<div class="stDayStripX"><span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span>24:00</span></div>';

    if (j) {
      const moodIco = j.mood >= 0 && j.mood < 5 ? iconSvg('mood' + j.mood, { size: 22 }) : iconSvg('journal', { size: 22 });
      const stars = typeof ratingIcons === 'function' && j.rating > 0 ? ratingIcons(j.rating, 12) : '';
      html += '<div class="stJCard"><div class="r1">' + moodIco + stars
        + '<button class="ghostBtn more" data-act="j-view" data-date="' + dateStr + '">' + iconText('journal', t('dlViewJournal')) + '</button></div>'
        + (j.headline ? '<div class="headline">' + escHtml(j.headline) + '</div>' : '')
        + ((j.tags && j.tags.length) ? '<div class="stTagChips" style="margin:6px 0 0">' + j.tags.map((x) => '<span>' + escHtml(x) + '</span>').join('') + '</div>' : '')
        + '</div>';
    }

    html += '<div class="stLogTitle" style="margin-top:12px">' + t('jDayBtn') + '</div>';
    html += blocks.length ? '<div class="stLog">' + stBlocksLogHtml(blocks) + '</div>' : '<div class="stEmpty">' + t('jNoStats') + '</div>';
    if (typeof skipLogHtml === 'function') html += skipLogHtml(dateStr);
  }
  $('#statsLayerBody').innerHTML = html;
}

function refreshOpenStatsDayLayer() {
  if (!statsLayer || !statsLayer.classList.contains('open') || stLayerMode !== 'day' || !stLayerDate) return;
  openStatsDayLayer(stLayerDate);
}

/* ---------- 报告层 ---------- */
function openStatsReportLayer() {
  stLayerMode = 'report';
  const SI = StudyTimerShared;
  const kind = stTrendKind === 'month' ? 'month' : 'week';
  const anchor = stTrendSeries().anchor;
  const r = SI.buildReport(state, { kind, anchor, T: tf, fmtMin });
  const m = r.metrics;
  const sub = kind === 'month'
    ? tf('trMonthLabel', Number(anchor.slice(0, 4)), Number(anchor.slice(5, 7)))
    : tf('trRange', stDateShort(m.from), stDateShort(m.to));
  stReportData = { title: t(kind === 'month' ? 'rpTitleMonth' : 'rpTitleWeek'), sub, lines: r.lines };
  openStatsLayer(stLayerHead(stReportData.title, sub));

  const delta = m.deltaPct === null ? '—' : (m.deltaPct >= 0 ? '+' : '') + m.deltaPct + '%';
  let html = '<div class="stReportMeta">'
    + '<div class="m"><div class="v">' + fmtMinShort(m.totalMin) + '</div><div class="k">' + t('statTotal') + '</div></div>'
    + '<div class="m"><div class="v">' + delta + '</div><div class="k">' + t('trDelta') + '</div></div>'
    + '<div class="m"><div class="v">' + m.studyDays + '/' + m.periodDays + '</div><div class="k">' + t('statStudyDays') + '</div></div>'
    + '<div class="m"><div class="v">' + fmtMinShort(m.avgPerDay) + '</div><div class="k">' + t('statAvg') + '</div></div>'
    + '<div class="m"><div class="v">' + (m.best ? fmtMinShort(m.best.min) : '—') + '</div><div class="k">' + t('statBestDay') + '</div></div>'
    + '<div class="m"><div class="v">' + (m.goalMin > 0 ? m.goalHit + '/' + m.periodDays : '—') + '</div><div class="k">' + t('rpMetaGoal') + '</div></div>'
    + '</div>';
  html += '<div class="stReportLines">' + r.lines.map((x) => '<div class="ln">' + x + '</div>').join('') + '</div>';
  html += '<button class="ghostBtn stCopyBtn" data-act="report-copy">' + iconText('export', t('rpCopy')) + '</button>';
  $('#statsLayerBody').innerHTML = html;
}
function stReportText() {
  return stReportData ? stReportData.title + ' · ' + stReportData.sub + '\n' + stReportData.lines.join('\n') : '';
}
function stCopyReport(btn) {
  const text = stReportText();
  const done = () => {
    const label = btn.querySelector('.icon-label');
    if (label) label.textContent = t('rpCopied');
    setTimeout(() => { if (btn.isConnected) { const l2 = btn.querySelector('.icon-label'); if (l2) l2.textContent = t('rpCopy'); } }, 1600);
  };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(done, () => stCopyFallback(text, done));
  } else stCopyFallback(text, done);
}
function stCopyFallback(text, done) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.cssText = 'position:fixed;opacity:0';
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand('copy'); done(); } catch (e) {}
  document.body.removeChild(ta);
}

/* ---------- 视图动作分发 ---------- */
function findReward(id) {
  const rewards = (state.points && Array.isArray(state.points.rewards)) ? state.points.rewards : [];
  return rewards.find((x) => x && x.id === id) || null;
}
function resetArmButtons() {
  document.querySelectorAll('.stRewardBtn.arm').forEach((b) => {
    b.classList.remove('arm');
    delete b.dataset.arm;
    b.textContent = t('rewardRedeem');
  });
}
function statsViewAction(act, el) {
  const SI = StudyTimerShared;
  switch (act) {
    case 'goal-edit':
      stGoalEditing = !stGoalEditing;
      renderStatsPanel({ quiet: true });
      return true;
    case 'goal-set': {
      state.goals = { dailyMin: Math.max(0, Math.round(Number(el.dataset.min) || 0)) };
      stGoalEditing = false;
      saveState();
      renderStatsPanel({ quiet: true });
      return true;
    }
    case 'trend-kind':
      stTrendKind = el.dataset.kind === 'month' || el.dataset.kind === 'year' ? el.dataset.kind : 'week';
      stTrendAnchor = '';
      renderStatsPanel();
      return true;
    case 'trend-prev':
    case 'trend-next':
      stTrendAnchor = el.dataset.anchor || today.str;
      renderStatsPanel();
      return true;
    case 'trend-month':
      stTrendKind = 'month';
      stTrendAnchor = el.dataset.anchor || today.str;
      renderStatsPanel();
      return true;
    case 'heat-prev':
    case 'heat-next':
      stHeatYear = Number(el.dataset.year) || today.y;
      renderStatsPanel();
      return true;
    case 'ins-range':
      stInsRange = ['30', 'year', 'all'].indexOf(el.dataset.range) >= 0 ? el.dataset.range : '30';
      renderStatsPanel();
      return true;
    case 'apps-range':
      stAppsRange = ['today', '7d', 'month', 'year', 'all'].indexOf(el.dataset.range) >= 0 ? el.dataset.range : 'today';
      renderStatsPanel();
      return true;
    case 'report':
      openStatsReportLayer();
      return true;
    case 'j-view':
      closeStatsPanel();
      openJournalPanel(el.dataset.date);
      return true;
    case 'layer-back':
      closeStatsLayer();
      return true;
    case 'layer-edit-day':
      openDayEditor(el.dataset.date || today.str);
      return true;
    case 'reward-add': {
      const nameEl = $('#stRewardName'), costEl = $('#stRewardCost');
      if (!nameEl || !costEl) return true;
      const name = String(nameEl.value || '').trim().slice(0, 20);
      const cost = Math.round(Number(costEl.value));
      if (!name || !Number.isFinite(cost) || cost < 1) return true;
      if (!state.points || typeof state.points !== 'object') state.points = { rewards: [], spends: [] };
      if (!Array.isArray(state.points.rewards)) state.points.rewards = [];
      state.points.rewards.push({ id: 'r' + Date.now() + Math.floor(Math.random() * 100), name, cost, createdAt: new Date().toISOString() });
      saveState();
      renderStatsPanel();
      return true;
    }
    case 'reward-del': {
      const r = findReward(el.dataset.id);
      if (!r) return true;
      if (!confirm(tf('rewardDelConfirm', r.name))) return true;
      state.points.rewards = state.points.rewards.filter((x) => x.id !== r.id);
      saveState();
      renderStatsPanel();
      return true;
    }
    case 'reward-redeem': {
      const r = findReward(el.dataset.id);
      if (!r) return true;
      const bal = SI.pointsBalance(state.dailyStats, state.points, state.achievements);
      if (bal.balance < r.cost) return true;
      if (el.dataset.arm !== '1') {
        // 两步确认：3 秒内再点一次才真正扣分
        el.dataset.arm = '1';
        el.classList.add('arm');
        el.textContent = t('rewardConfirm');
        clearTimeout(stArmTimer);
        stArmTimer = setTimeout(resetArmButtons, 3000);
        return true;
      }
      if (!Array.isArray(state.points.spends)) state.points.spends = [];
      state.points.spends.push({ id: r.id, name: r.name, cost: r.cost, at: new Date().toISOString() });
      saveState();
      stRedeemFlash = tf('redeemedFlash', r.name, SI.pointsBalance(state.dailyStats, state.points, state.achievements).balance);
      renderStatsPanel();
      setTimeout(() => {
        if (!stRedeemFlash) return;
        stRedeemFlash = '';
        if (statsOverlay.classList.contains('open') && statsRange === 'awards') renderStatsPanel({ quiet: true });
      }, 3500);
      return true;
    }
    case 'rest-redeem': {
      const rvBal = SI.pointsBalance(state.dailyStats, state.points, state.achievements);
      const rv = SI.restVoucherState(state.points && state.points.spends, new Date());
      if (rvBal.balance < rv.price) return true;
      if (el.dataset.arm !== '1') {
        el.dataset.arm = '1';
        el.classList.add('arm');
        el.textContent = t('rewardConfirm');
        clearTimeout(stArmTimer);
        stArmTimer = setTimeout(resetArmButtons, 3000);
        return true;
      }
      if (!state.points || typeof state.points !== 'object') state.points = { rewards: [], spends: [] };
      if (!Array.isArray(state.points.spends)) state.points.spends = [];
      state.points.spends.push({ kind: 'rest', name: t('restVoucherName'), cost: rv.price, at: new Date().toISOString() });
      // 兑换即收工：跳过今天剩余学习块（当天日程已结束则只扣分）
      const skippedN = skipRemainingStudyBlocks(tf('restVoucherReason', rv.count + 1));
      saveState();
      tick();
      let flash = tf('redeemedFlash', t('restVoucherName'), SI.pointsBalance(state.dailyStats, state.points, state.achievements).balance);
      if (skippedN) flash += ' · ' + tf('restVoucherSkipped', skippedN);
      stRedeemFlash = flash;
      renderStatsPanel();
      setTimeout(() => {
        if (!stRedeemFlash) return;
        stRedeemFlash = '';
        if (statsOverlay.classList.contains('open') && statsRange === 'awards') renderStatsPanel({ quiet: true });
      }, 3500);
      return true;
    }
    case 'report-copy':
      stCopyReport(el);
      return true;
    default:
      return false;
  }
}
