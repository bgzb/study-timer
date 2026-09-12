const test = require('node:test');
const assert = require('node:assert/strict');
const { todosOf, unfinishedTodosOf, todoStatsOf, todosToPlanText } = require('../src/renderer/shared/todo-model.js');

const todos = {
  '2026-09-04': [
    { id: '1', text: '刷完一套阅读', done: false, blockKey: '0-0' },
    { id: '2', text: '背 50 个单词', done: true, blockKey: '0-0' },
    { id: '3', text: '整理错题', done: false },
    { id: '4', text: '拉伸', done: false, blockKey: '0-1' }
  ],
  '2026-09-03': [{ id: '9', text: '旧任务', done: true }]
};

const blockLabel = (key) => ({ '0-0': '上午', '0-1': '下午' }[key] || null);

test('todosOf filters by date and drops malformed items; unknown dates are empty', () => {
  assert.equal(todosOf(todos, '2026-09-04').length, 4);
  assert.equal(todosOf(todos, '2026-09-10').length, 0);
  assert.equal(todosOf(null, '2026-09-04').length, 0);
  assert.equal(todosOf({ '2026-09-04': 'bad' }, '2026-09-04').length, 0);
  assert.equal(todosOf({ '2026-09-04': [null, { text: 'ok' }, {}] }, '2026-09-04').length, 1);
});

test('unfinishedTodosOf keeps only undone items', () => {
  const list = unfinishedTodosOf(todos, '2026-09-04');
  assert.deepEqual(list.map((x) => x.id), ['1', '3', '4']);
});

test('todoStatsOf counts done/total per day', () => {
  assert.deepEqual(todoStatsOf(todos, '2026-09-04'), { total: 4, done: 1 });
  assert.deepEqual(todoStatsOf(todos, '2026-09-03'), { total: 1, done: 1 });
});

test('todosToPlanText groups by block label, others under the fallback label', () => {
  const plan = todosToPlanText(unfinishedTodosOf(todos, '2026-09-04'), blockLabel, '其他');
  const lines = plan.split('\n');
  assert.equal(lines[0], '[上午] 刷完一套阅读');
  assert.equal(lines[1], '[下午] 拉伸');
  assert.equal(lines[2], '[其他] 整理错题');
});

test('todosToPlanText merges same-label items into one line and returns empty for empty input', () => {
  const plan = todosToPlanText([
    { text: 'a', blockKey: '0-0' }, { text: 'b', blockKey: '0-0' }
  ], blockLabel, '其他');
  assert.equal(plan, '[上午] a；b');
  assert.equal(todosToPlanText([], blockLabel, '其他'), '');
  assert.equal(todosToPlanText([{ text: '', blockKey: '0-0' }], blockLabel, '其他'), '');
  assert.equal(todosToPlanText(null, blockLabel, '其他'), '');
});
