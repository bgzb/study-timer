'use strict';

/* ==================== 常量 ==================== */
const MOODS = ['😤', '😕', '😐', '😊', '🤩'];
const T = {
  zh: {
    titleNew: '✍ 今日复盘', titleEdit: '✍ 编辑这篇总结',
    recapFocus: '专注', recapDone: '完成', recapSkip: '跳过',
    recapNone: '这一天没有学习记录',
    studyWord: '学习', breakWord: '休息',
    skipLogTitle: '跳过记录', skipNoReason: '未填写原因', skipAtTime: (tm) => '跳过于 ' + tm,
    editDayBtn: '✏ 编辑时间块',
    durH: (h, m) => h + '时' + m + '分', durM: (m) => m + '分',
    block: (d, t2) => d + '/' + t2,
    lbHeadline: '一句话形容今天', phHeadline: '今天像…',
    lbMood: '今日心情', lbRating: '今日自评',
    moodLabels: ['煎熬', '不佳', '平静', '不错', '超赞'],
    lbTags: '给今天贴个标签', tagSub: '可多选，也可自定义', phTag: '自定义标签…', tagAdd: '＋',
    lbGood: '今天做得好的', phGood: '哪些事推进顺利？哪些瞬间值得记住？',
    lbImprove: '可以改进的', phImprove: '哪里分心了？下次遇到同样情况怎么应对？',
    lbPlan: '明天想做的', phPlan: '给明天的自己留一句话或一个小目标…',
    later: '稍后再说', saveNew: '保存今日总结', saveEdit: '保存修改',
    saved: '已保存，明天见 👋',
    weekend: ['日', '一', '二', '三', '四', '五', '六'],
    presetTags: ['专注', '高效', '拖延', '疲惫', '熬夜', '运动', '阅读', '复盘']
  },
  en: {
    titleNew: '✍ Daily Review', titleEdit: '✍ Edit this review',
    recapFocus: 'Focus', recapDone: 'Blocks', recapSkip: 'Skipped',
    recapNone: 'No study records this day',
    studyWord: 'Study', breakWord: 'Break',
    skipLogTitle: 'Skipped blocks', skipNoReason: 'No reason given', skipAtTime: (tm) => 'skipped at ' + tm,
    editDayBtn: '✏ Edit blocks',
    durH: (h, m) => h + 'h ' + m + 'm', durM: (m) => m + 'm',
    block: (d, t2) => d + '/' + t2,
    lbHeadline: 'Describe today in one line', phHeadline: 'Today felt like…',
    lbMood: 'Mood', lbRating: 'Rating',
    moodLabels: ['Rough', 'Meh', 'Okay', 'Good', 'Great'],
    lbTags: 'Tag the day', tagSub: 'multi-select, custom ok', phTag: 'Custom tag…', tagAdd: '＋',
    lbGood: 'What went well', phGood: 'What moved forward? Any moments worth keeping?',
    lbImprove: 'To improve', phImprove: 'Where did focus slip? How to handle it next time?',
    lbPlan: 'For tomorrow', phPlan: 'Leave a note or a small goal for tomorrow…',
    later: 'Not now', saveNew: 'Save review', saveEdit: 'Save changes',
    saved: 'Saved — see you tomorrow 👋',
    weekend: ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'],
    presetTags: ['Focused', 'Productive', 'Procrastinated', 'Tired', 'Late night', 'Exercise', 'Reading', 'Review']
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

const params = new URLSearchParams(location.search);
const date = shared.parseDate(params.get('date'));
let state = loadState();
const lang = state.language === 'en' ? 'en' : 'zh';
function tt(key) { const v = T[lang][key]; return v != null ? v : T.zh[key]; }

/* ==================== 静态文案渲染 ==================== */

function renderChrome() {
  document.title = tt('titleNew').replace('✍ ', '');
  const d = new Date(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10)));
  const now = new Date();
  const zh = lang !== 'en';
  const dayLabel = zh
    ? (d.getMonth() + 1) + '月' + d.getDate() + '日 · 星期' + tt('weekend')[d.getDay()]
    : ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()] + ' ' + d.getDate() + ' · ' + tt('weekend')[d.getDay()];
  const yr = d.getFullYear() !== now.getFullYear() ? d.getFullYear() + (zh ? '年' : ' ') : '';
  $('#dateLine').textContent = yr + dayLabel;

  $('#lbHeadline').textContent = tt('lbHeadline');
  $('#headline').placeholder = tt('phHeadline');
  $('#lbMood').textContent = tt('lbMood');
  $('#lbRating').textContent = tt('lbRating');
  $('#lbTags').textContent = tt('lbTags');
  $('#tagSub').textContent = tt('tagSub');
  $('#tagInput').placeholder = tt('phTag');
  $('#tagAddBtn').textContent = tt('tagAdd');
  $('#lbGood').textContent = tt('lbGood'); $('#good').placeholder = tt('phGood');
  $('#lbImprove').textContent = tt('lbImprove'); $('#improve').placeholder = tt('phImprove');
  $('#lbPlan').textContent = tt('lbPlan'); $('#planT').placeholder = tt('phPlan');
  $('#laterBtn').textContent = tt('later');
  $('#savedTxt').textContent = tt('saved');
  $('#editDayBtn').textContent = tt('editDayBtn');
}

function $(sel) { return document.querySelector(sel); }

function renderRecap() {
  const st = (state.dailyStats || {})[date];
  const card = $('#recapCard');
  if (!st) {
    card.className = 'recap none';
    card.textContent = tt('recapNone');
    return;
  }
  const min = Math.round(st.focusMin || 0);
  const h = Math.floor(min / 60), m = min % 60;
  card.className = 'recap';
  card.innerHTML =
    '<div class="cell"><div class="v">' + (h > 0 ? tt('durH')(h, m) : tt('durM')(m)) + '</div><div class="k">' + tt('recapFocus') + '</div></div>'
    + '<div class="cell"><div class="v">' + tt('block')(st.done || 0, st.total || 0) + '</div><div class="k">' + tt('recapDone') + '</div></div>'
    + '<div class="cell"><div class="v">' + (st.skipped || 0) + '</div><div class="k">' + tt('recapSkip') + '</div></div>';
}

/* 跳过记录：读 skips 事件日志（含理由与块快照），当天没有跳过则整卡隐藏 */
function renderSkipCard() {
  const card = $('#skipCard');
  const list = ((state.skips || {})[date] || []).filter((x) => x && x.key);
  if (!list.length) { card.style.display = 'none'; return; }
  card.style.display = '';
  let rows = '';
  for (const x of list) {
    const type = x.type
      ? '<span class="skType ' + (x.type === 'break' ? 'brk' : 'sty') + '">' + tt(x.type === 'break' ? 'breakWord' : 'studyWord') + '</span>'
      : '';
    const range = x.start != null && x.end != null
      ? fmtClock(x.start) + ' – ' + fmtClock(x.end)
      : (x.at != null ? tt('skipAtTime')(fmtClock(x.at)) : '');
    rows += '<div class="skipRow">' + type
      + '<span class="t">' + range + '</span>'
      + '<span class="r">' + (x.reason ? escText(x.reason) : tt('skipNoReason')) + '</span>'
      + '</div>';
  }
  card.innerHTML = '<div class="skipTitle">' + tt('skipLogTitle') + '<span class="n">' + list.length + '</span></div>' + rows;
}

/* ==================== 表单交互 ==================== */

let mood = -1;      // 0-4，-1 未选
let rating = 0;     // 0-5，0 未评
let customTags = []; // 自定义标签（预设标签单独记录选中态）

function renderMoodRow() {
  const row = $('#moodRow');
  row.innerHTML = '';
  MOODS.forEach((emoji, i) => {
    const b = document.createElement('button');
    b.className = 'moodBtn' + (mood === i ? ' on' : '');
    b.innerHTML = emoji + '<span class="ml">' + tt('moodLabels')[i] + '</span>';
    b.addEventListener('click', () => { mood = (mood === i ? -1 : i); renderMoodRow(); updateSaveBtn(); });
    row.appendChild(b);
  });
}

function renderStarRow() {
  const row = $('#starRow');
  row.innerHTML = '';
  for (let i = 1; i <= 5; i++) {
    const b = document.createElement('button');
    b.className = 'starBtn' + (i <= rating ? ' on' : '');
    b.textContent = i <= rating ? '★' : '☆';
    b.addEventListener('click', () => { rating = (rating === i ? 0 : i); renderStarRow(); updateSaveBtn(); });
    row.appendChild(b);
  }
  const hint = document.createElement('span');
  hint.id = 'starHint';
  hint.textContent = rating > 0 ? rating + '/5' : '';
  row.appendChild(hint);
}

function selectedTags() {
  const presets = tt('presetTags');
  const sel = presets.filter((p) => presetOn.has(p));
  return sel.concat(customTags);
}
const presetOn = new Set();

function renderTagRow() {
  const row = $('#tagRow');
  row.innerHTML = '';
  const presets = tt('presetTags');
  presets.forEach((p) => {
    const b = document.createElement('button');
    b.className = 'tagChip' + (presetOn.has(p) ? ' on' : '');
    b.textContent = p;
    b.addEventListener('click', () => {
      if (presetOn.has(p)) presetOn.delete(p); else presetOn.add(p);
      renderTagRow(); updateSaveBtn();
    });
    row.appendChild(b);
  });
  customTags.forEach((c) => {
    const b = document.createElement('button');
    b.className = 'tagChip custom on';
    b.title = lang === 'en' ? 'Click to remove' : '点击移除';
    b.innerHTML = escText(c) + '<span class="x">✕</span>';
    b.addEventListener('click', () => {
      customTags = customTags.filter((x) => x !== c);
      renderTagRow(); updateSaveBtn();
    });
    row.appendChild(b);
  });
}

function addCustomTag() {
  const input = $('#tagInput');
  const v = input.value.trim();
  if (!v) return;
  const presets = tt('presetTags');
  if (presets.includes(v)) { presetOn.add(v); }
  else if (!customTags.includes(v)) customTags.push(v);
  input.value = '';
  renderTagRow(); updateSaveBtn();
}
$('#tagAddBtn').addEventListener('click', addCustomTag);
$('#tagInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addCustomTag(); } });

function collect() {
  return {
    headline: $('#headline').value.trim(),
    mood: mood,
    rating: rating,
    tags: selectedTags(),
    good: $('#good').value.trim(),
    improve: $('#improve').value.trim(),
    plan: $('#planT').value.trim()
  };
}

function updateSaveBtn() {
  const c = collect();
  const any = c.headline || c.mood >= 0 || c.rating > 0 || c.tags.length || c.good || c.improve || c.plan;
  $('#saveBtn').disabled = !any;
}

['headline', 'good', 'improve', 'planT'].forEach((id) => {
  $('#' + id).addEventListener('input', updateSaveBtn);
});

/* ==================== 保存 / 稍后 ==================== */

let busy = false;

$('#saveBtn').addEventListener('click', () => {
  if (busy) return;
  busy = true;
  const c = collect();
  // 保存前重读最新状态，只改写本日条目，避免覆盖其他窗口刚写入的数据
  state = loadState();
  if (!state.journal) state.journal = {};
  if (!state.summaryDismissed) state.summaryDismissed = {};
  const prev = state.journal[date];
  state.journal[date] = {
    headline: c.headline, mood: c.mood, rating: c.rating, tags: c.tags,
    good: c.good, improve: c.improve, plan: c.plan,
    savedAt: prev ? prev.savedAt : new Date().toISOString(),
    editedAt: prev ? new Date().toISOString() : undefined
  };
  delete state.summaryDismissed[date]; // 保存即视为已记录，解除"稍后再说"
  saveState(state);
  $('#savedMask').classList.add('show');
  setTimeout(() => { window.close(); }, 1200);
});

$('#laterBtn').addEventListener('click', () => {
  if (busy) return;
  busy = true;
  // 仅对"今天"记录跳过：编辑历史日期时关闭不应影响今天的提醒
  if (date === todayStr()) {
    state = loadState();
    if (!state.summaryDismissed) state.summaryDismissed = {};
    state.summaryDismissed[date] = true;
    saveState(state);
  }
  window.close();
});

/* ==================== 预填已有条目 ==================== */

function prefill() {
  const e = (state.journal || {})[date];
  if (!e) return;
  mood = typeof e.mood === 'number' && e.mood >= 0 && e.mood < MOODS.length ? e.mood : -1;
  rating = typeof e.rating === 'number' ? Math.min(5, Math.max(0, e.rating)) : 0;
  $('#headline').value = e.headline || '';
  $('#good').value = e.good || '';
  $('#improve').value = e.improve || '';
  $('#planT').value = e.plan || '';
  const presets = tt('presetTags');
  (e.tags || []).forEach((tag) => {
    if (presets.includes(tag)) presetOn.add(tag);
    else if (tag && !customTags.includes(tag)) customTags.push(tag);
  });
  $('#titleLine').textContent = tt('titleEdit');
  $('#saveBtn').textContent = tt('saveEdit');
}

/* 其他窗口改了共享状态 → 静默吸收（表单内容由用户输入主导，保存时会重读合并） */
if (bridge && bridge.onStateSync) bridge.onStateSync(() => {});

/* 编辑该日时间块（做的事/算专注/备注） */
$('#editDayBtn').addEventListener('click', () => {
  if (bridge && bridge.openDay) bridge.openDay(date);
  else window.open('day.html?date=' + date, '_blank');
});

/* ==================== 启动 ==================== */

renderChrome();
renderRecap();
renderSkipCard();
prefill();
renderMoodRow();
renderStarRow();
renderTagRow();
updateSaveBtn();
