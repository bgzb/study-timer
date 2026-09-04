'use strict';

/* ==================== 常量与文案 ==================== */
const T = {
  zh: {
    title: '时间块记录',
    recapFocus: '专注', recapDone: '完成', recapSkip: '跳过',
    recapNone: '这一天没有时段安排',
    studyWord: '学习', breakWord: '休息', min: '分钟',
    stNow: '进行中', stSkipped: '已跳过', stUpcoming: '待开始', stDone: '已结束',
    skipReasonLabel: '原因',
    skipNoReason: '未填写原因',
    lbAct: '做的事', lbNote: '备注',
    phActStudy: '默认：学习（可填 数学、读论文…）',
    phActBreak: '默认：休息（可填 小憩、散步…）',
    phNote: '补充说明…',
    focusLabel: '算专注', focusOffLabel: '不算专注',
    reset: '还原默认', save: '保存', close: '关闭', saved: '已保存',
    confirmReset: '还原该日全部时间块编辑（做的事/算专注/备注）？',
    weekend: ['日', '一', '二', '三', '四', '五', '六'],
    durM: (m) => m + ' 分钟'
  },
  en: {
    title: 'Block Log',
    recapFocus: 'Focus', recapDone: 'Blocks', recapSkip: 'Skipped',
    recapNone: 'No sessions scheduled this day',
    studyWord: 'Study', breakWord: 'Break', min: ' min',
    stNow: 'Now', stSkipped: 'Skipped', stUpcoming: 'Upcoming', stDone: 'Done',
    skipReasonLabel: 'Reason',
    skipNoReason: 'No reason given',
    lbAct: 'Activity', lbNote: 'Note',
    phActStudy: 'Default: study (e.g. math, reading…)',
    phActBreak: 'Default: break (e.g. nap, walk…)',
    phNote: 'Extra notes…',
    focusLabel: 'Counts as focus', focusOffLabel: 'Not focus',
    reset: 'Reset', save: 'Save', close: 'Close', saved: 'Saved',
    confirmReset: 'Reset all block edits (activity/focus/note) for this day?',
    weekend: ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'],
    durM: (m) => m + 'm'
  }
};

const bridge = window.studyTimer || null;
const shared = window.StudyTimerShared;
const STORE_KEY = shared.STORE_KEY;
const loadState = () => shared.loadState();
const saveState = (value) => shared.saveState(value);
const pad2 = shared.pad2;
const fmtClock = shared.fmtClock;
const escText = shared.escHtml;
const todayStr = shared.todayStr;
const nowSeconds = shared.nowSeconds;
const { iconSvg } = window.StudyTimerIcons || {};

const params = new URLSearchParams(location.search);
const date = shared.parseDate(params.get('date'));
const isToday = date === todayStr();

let state = loadState();
const lang = state.language === 'en' ? 'en' : 'zh';
function tt(key) { const v = T[lang][key]; return v != null ? v : T.zh[key]; }

/* 领域规则统一由 shared/schedule-model.js 与 stats-model.js 提供。 */
const daySkips = (state.skips || {})[date] || [];
const skipMap = {};
for (const x of daySkips) skipMap[x.key] = x;
const dayEdits = ((state.blocks || {})[date]) || {};
const mode = shared.modeFor(date, state);
const sessions = shared.mergeExtraSessions(((state.schedules || {})[mode] || []), ((state.extra || {})[date] || []));
const built = shared.expandDay(sessions, daySkips);
const settleAt = isToday ? nowSeconds() : 86399;

function editOf(b) { return dayEdits[b.key] || null; }
function focusFlagOf(b) { return shared.focusFlagOf(b, dayEdits); }
// 打卡门禁同口径：该日起算秒（未打卡且门禁启用后的日子整天不计）
const countFrom = shared.countFromOf(state, date);
function computeRecap(edits) { return shared.computeRecap(built, edits, settleAt, countFrom); }

/* ==================== 渲染 ==================== */

function $(sel) { return document.querySelector(sel); }

function renderChrome() {
  document.title = tt('title');
  const p = date.split('-').map(Number);
  const d = new Date(p[0], p[1] - 1, p[2]);
  const zh = lang !== 'en';
  $('#dateLine').textContent = zh
    ? (d.getMonth() + 1) + '月' + d.getDate() + '日 · 星期' + tt('weekend')[d.getDay()]
    : ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()] + ' ' + d.getDate() + ' · ' + tt('weekend')[d.getDay()];
  $('#titleLine .title-text').textContent = tt('title');
  $('#resetBtn').textContent = tt('reset');
  $('#saveBtn').textContent = tt('save');
  $('#closeBtn').title = tt('close');
  $('#closeBtn').setAttribute('aria-label', tt('close'));
  $('#savedTxt').textContent = tt('saved');
  if (iconSvg) {
    document.querySelectorAll('span[data-icon]').forEach((slot) => {
      if (!slot.childElementCount) slot.innerHTML = iconSvg(slot.dataset.icon, { size: slot.dataset.iconSize || 18 });
    });
  }
}

function renderRecap() {
  const card = $('#recapCard');
  if (!built.blocks.length) {
    card.className = 'recap none';
    card.textContent = tt('recapNone');
    return;
  }
  const r = computeRecap(collectEdits());
  card.className = 'recap';
  card.innerHTML =
    '<div class="cell"><div class="v">' + r.focusMin + tt('min') + '</div><div class="k">' + tt('recapFocus') + '</div></div>'
    + '<div class="cell"><div class="v">' + r.done + '/' + r.total + '</div><div class="k">' + tt('recapDone') + '</div></div>'
    + '<div class="cell"><div class="v">' + r.skipped + '</div><div class="k">' + tt('recapSkip') + '</div></div>';
}

function statusOf(b) {
  const now = isToday ? nowSeconds() : 86400;
  if (isToday && b.start <= now && now < b.effEnd) return 'now';
  if (b.effEnd < b.end) return 'skipped';
  if (b.start > now) return 'upcoming';
  return 'done';
}

function renderBlocks() {
  const list = $('#blockList');
  list.innerHTML = '';
  if (!built.blocks.length) return;
  let curSess = -1;
  for (const b of built.blocks) {
    if (b.sIdx !== curSess) {
      curSess = b.sIdx;
      const s = built.sess[curSess];
      const h = document.createElement('div');
      h.className = 'sessHead';
      h.textContent = s.name + ' · ' + fmtClock(s.start);
      list.appendChild(h);
    }
    const ed = editOf(b);
    const st = statusOf(b);
    const sk = skipMap[b.key];
    const card = document.createElement('div');
    card.className = 'bCard' + (st === 'now' ? ' now' : '');
    card.dataset.key = b.key;

    const typeWord = b.type === 'study' ? tt('studyWord') : tt('breakWord');
    const stWord = { now: tt('stNow'), skipped: tt('stSkipped'), upcoming: tt('stUpcoming'), done: tt('stDone') }[st];
    const head = document.createElement('div');
    head.className = 'bHead';
    head.innerHTML =
      '<span class="skType ' + (b.type === 'break' ? 'brk' : 'sty') + '">' + typeWord + '</span>'
      + '<span class="t">' + fmtClock(b.start) + ' – ' + fmtClock(b.effEnd) + '</span>'
      + '<span class="st ' + st + '">' + stWord + '</span>'
      + '<span class="m">' + tt('durM')(Math.round((b.effEnd - b.start) / 60 * 10) / 10) + '</span>';
    card.appendChild(head);

    if (st === 'skipped') {
      const r = document.createElement('div');
      r.className = 'skipReason';
      r.innerHTML = tt('skipReasonLabel') + '：<b>' + escText((sk && sk.reason) || tt('skipNoReason')) + '</b>';
      card.appendChild(r);
    }

    const row1 = document.createElement('div');
    row1.className = 'bRow';
    const lb1 = document.createElement('span');
    lb1.className = 'lb';
    lb1.textContent = tt('lbAct');
    const act = document.createElement('input');
    act.type = 'text';
    act.maxLength = 20;
    act.className = 'actIn';
    act.value = (ed && ed.act) || '';
    act.placeholder = b.type === 'study' ? tt('phActStudy') : tt('phActBreak');
    row1.appendChild(lb1);
    row1.appendChild(act);
    card.appendChild(row1);

    const row2 = document.createElement('div');
    row2.className = 'bRow';
    const fWrap = document.createElement('label');
    const fOn = focusFlagOf(b);
    fWrap.className = 'fLabel' + (fOn ? '' : ' off');
    const fcb = document.createElement('input');
    fcb.type = 'checkbox';
    fcb.checked = fOn;
    fcb.addEventListener('change', () => {
      fWrap.classList.toggle('off', !fcb.checked);
      fWrap.querySelector('.ftxt').textContent = fcb.checked ? tt('focusLabel') : tt('focusOffLabel');
    });
    const ftxt = document.createElement('span');
    ftxt.className = 'ftxt';
    ftxt.textContent = fOn ? tt('focusLabel') : tt('focusOffLabel');
    fWrap.appendChild(fcb);
    fWrap.appendChild(ftxt);
    const lb2 = document.createElement('span');
    lb2.className = 'lb';
    lb2.textContent = tt('lbNote');
    const note = document.createElement('input');
    note.type = 'text';
    note.maxLength = 60;
    note.className = 'noteIn';
    note.value = (ed && ed.note) || '';
    note.placeholder = tt('phNote');
    row2.appendChild(fWrap);
    row2.appendChild(lb2);
    row2.appendChild(note);
    card.appendChild(row2);

    list.appendChild(card);
  }
}

/* ==================== 保存与还原 ==================== */

let busy = false;

function collectEdits() {
  const out = {};
  for (const card of document.querySelectorAll('.bCard')) {
    const key = card.dataset.key;
    const b = built.blocks.find((x) => x.key === key);
    if (!b) continue;
    const act = card.querySelector('.actIn').value.trim();
    const note = card.querySelector('.noteIn').value.trim();
    const focus = card.querySelector('.fLabel input').checked;
    const defFocus = b.type === 'study';
    const entry = {};
    if (act) entry.act = act;
    if (note) entry.note = note;
    if (focus !== defFocus) entry.focus = focus;
    if (Object.keys(entry).length) out[key] = entry;
  }
  return out;
}

function recomputeDaily(edits) {
  // state 在保存前会被重读，起算秒以最新状态为准（页面开着时可能在别处打了卡）
  return shared.snapshot(built, { blocks: { [date]: edits }, skips: { [date]: daySkips } }, settleAt, date, shared.countFromOf(state, date));
}

$('#closeBtn').addEventListener('click', () => { window.close(); });

$('#saveBtn').addEventListener('click', () => {
  if (busy) return;
  busy = true;
  const edits = collectEdits();
  // 保存前重读最新状态，只改写本日条目，避免覆盖其他窗口刚写入的数据
  state = loadState();
  state.blocks = state.blocks || {};
  if (Object.keys(edits).length) state.blocks[date] = edits;
  else delete state.blocks[date];
  if (built.blocks.length) {
    state.dailyStats = state.dailyStats || {};
    state.dailyStats[date] = recomputeDaily(edits);
  }
  saveState(state);
  $('#savedMask').classList.add('show');
  setTimeout(() => { window.close(); }, 1000);
});

$('#resetBtn').addEventListener('click', () => {
  if (busy) return;
  if (!confirm(tt('confirmReset'))) return;
  for (const card of document.querySelectorAll('.bCard')) {
    const key = card.dataset.key;
    const b = built.blocks.find((x) => x.key === key);
    if (!b) continue;
    card.querySelector('.actIn').value = '';
    card.querySelector('.noteIn').value = '';
    const cb = card.querySelector('.fLabel input');
    cb.checked = b.type === 'study';
    cb.dispatchEvent(new Event('change'));
  }
  renderRecap();
});

/* 输入即联动顶部概览（未保存前仅供预览） */
$('#blockList').addEventListener('input', renderRecap);
$('#blockList').addEventListener('change', renderRecap);

/* 其他窗口改了共享状态 → 静默吸收（表单内容由用户输入主导，保存时会重读合并） */
if (bridge && bridge.onStateSync) bridge.onStateSync(() => {});

/* ==================== 启动 ==================== */

renderChrome();
renderRecap();
renderBlocks();
