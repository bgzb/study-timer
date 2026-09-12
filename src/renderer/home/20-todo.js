/* ==================== 今日待办 ==================== */
/* 待办按天存共享 state（todos[date]），可挂到当日时间块（blockKey）；
   「复制为计划」把未完成项拼成 plan 文本，粘进总结页即可。
   打开入口在侧边抽屉（17-tool-drawer.js 的 DRAWER_ACTIONS.todo）。 */

const todoOverlay = $('#todoOverlay');
let todoSig = null;

function blockLabelOf(blockKey) {
  const b = day.blocks.find((x) => x.key === blockKey);
  if (!b) return null;
  return day.sess[b.sIdx].name + ' ' + fmtClock(b.start);
}

function fillTodoBlockSel(sel, keep) {
  const val = keep != null ? keep : sel.value;
  sel.innerHTML = '';
  const none = document.createElement('option');
  none.value = '';
  none.textContent = t('todoNoBlock');
  sel.appendChild(none);
  for (const b of day.blocks) {
    const opt = document.createElement('option');
    const label = blockLabelOf(b.key);
    // 休息块显式标注，不靠暗号圆点区分
    opt.value = b.key;
    opt.textContent = b.type === 'study' ? label : label + '（' + t('breakWord') + '）';
    sel.appendChild(opt);
  }
  sel.value = [...sel.options].some((o) => o.value === val) ? val : '';
}

function todoRowHtml(it) {
  const tag = it.blockKey && blockLabelOf(it.blockKey)
    ? '<span class="tdo-tag">' + escHtml(blockLabelOf(it.blockKey)) + '</span>' : '';
  return '<div class="tdoRow' + (it.done ? ' done' : '') + '" data-id="' + it.id + '">'
    + '<button class="tdo-chk" role="checkbox" aria-checked="' + !!it.done + '" aria-label="' + escHtml(it.text) + '">' + iconSvg('check', { size: 13 }) + '</button>'
    + '<span class="tdo-text">' + escHtml(it.text) + '</span>' + tag
    + '<button class="tdo-del" aria-label="' + t('delRow') + '">' + iconSvg('close', { size: 13 }) + '</button>'
    + '</div>';
}

function renderTodoPanel() {
  if (!todoOverlay.classList.contains('open')) return;
  const list = StudyTimerShared.todosOf(state.todos, today.str);
  const stats = StudyTimerShared.todoStatsOf(state.todos, today.str);
  $('#todoCount').textContent = list.length ? t('todoDoneCnt')(stats.done, stats.total) : '';
  $('#todoList').innerHTML = list.length
    ? list.map(todoRowHtml).join('')
    : '<div class="jEmpty">' + t('todoEmpty') + '</div>';
  fillTodoBlockSel($('#todoBlockSel'));
  todoSig = JSON.stringify(state.todos || {});
}

function openTodoPanel() {
  todoOverlay.classList.add('open');
  renderTodoPanel();
  scheduleBarResize();
}
function closeTodoPanel() {
  todoOverlay.classList.remove('open');
  scheduleBarResize();
}

/* 状态同步时：待办内容真的变了才重绘（两端同步 / 别的窗口增删时保持面板新鲜） */
function refreshTodoIfChanged() {
  if (!todoOverlay.classList.contains('open')) { todoSig = null; return; }
  const sig = JSON.stringify(state.todos || {});
  if (sig === todoSig) return;
  renderTodoPanel();
}

function saveTodos() {
  saveState();
  renderTodoPanel();
  tick();
}

function addTodo() {
  const input = $('#todoInput');
  const text = input.value.trim();
  if (!text) { input.focus(); return; }
  if (!state.todos || typeof state.todos !== 'object') state.todos = {};
  const list = state.todos[today.str] || (state.todos[today.str] = []);
  list.push({
    id: 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    text, done: false,
    blockKey: $('#todoBlockSel').value || undefined,
    createdAt: new Date().toISOString()
  });
  input.value = '';
  saveTodos();
  input.focus();
}

/* 复制为计划：未完成待办 → 手记 plan 预填文本（挂块按块名分组，未挂块归「其他」） */
function copyTodoPlan(btn) {
  const text = StudyTimerShared.todosToPlanText(
    StudyTimerShared.unfinishedTodosOf(state.todos, today.str), blockLabelOf, t('todoOther'));
  if (!text) return;
  const done = () => {
    const label = btn.querySelector('.icon-label');
    if (label) label.textContent = t('todoCopied');
    setTimeout(() => { if (btn.isConnected && label) label.textContent = t('todoCopyPlan'); }, 2200);
  };
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, done);
  else done();
}

$('#closeTodo').addEventListener('click', closeTodoPanel);
todoOverlay.addEventListener('click', (e) => { if (e.target === todoOverlay) closeTodoPanel(); });
$('#todoAddBtn').addEventListener('click', addTodo);
$('#todoInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); addTodo(); }
});
$('#todoClearDone').addEventListener('click', () => {
  const list = StudyTimerShared.todosOf(state.todos, today.str).filter((x) => !x.done);
  if (!state.todos) state.todos = {};
  if (list.length) state.todos[today.str] = list;
  else delete state.todos[today.str];
  saveTodos();
});
$('#todoCopyPlan').addEventListener('click', (e) => copyTodoPlan(e.currentTarget));
$('#todoList').addEventListener('click', (e) => {
  const row = e.target.closest('.tdoRow');
  if (!row || !row.dataset.id) return;
  const list = StudyTimerShared.todosOf(state.todos, today.str);
  const it = list.find((x) => x.id === row.dataset.id);
  if (!it) return;
  if (e.target.closest('.tdo-chk')) it.done = !it.done;
  else if (e.target.closest('.tdo-del')) state.todos[today.str] = list.filter((x) => x.id !== it.id);
  else return;
  saveTodos();
});
