const test = require('node:test');
const assert = require('node:assert/strict');
const { daysUntil, sortedCountdowns, trayCountdownSuffix } = require('../src/renderer/shared/countdown-model.js');

test('daysUntil: same day is 0, future positive, past negative, cross-month/year correct', () => {
  assert.equal(daysUntil('2026-09-04', '2026-09-04'), 0);
  assert.equal(daysUntil('2026-09-05', '2026-09-04'), 1);
  assert.equal(daysUntil('2026-10-01', '2026-09-04'), 27);
  assert.equal(daysUntil('2027-01-01', '2026-09-04'), 119);
  assert.equal(daysUntil('2026-09-03', '2026-09-04'), -1);
  assert.equal(daysUntil('2026-02-28', '2026-03-01'), -1); // 2026 非闰年
  assert.ok(isNaN(daysUntil('bad', '2026-09-04')));
  assert.ok(isNaN(daysUntil('2026-09-05', null)));
});

test('sortedCountdowns: future first ascending, then expired; invalid dates dropped', () => {
  const list = sortedCountdowns([
    { id: 'a', name: '已过', date: '2026-08-30' },
    { id: 'b', name: '考研', date: '2026-12-20' },
    { id: 'c', name: '今天', date: '2026-09-04' },
    { id: 'd', name: '月考', date: '2026-09-20' },
    { id: 'e', name: '更早过期', date: '2026-08-01' },
    { id: 'f', name: '坏日期', date: 'not-a-date' }
  ], '2026-09-04');
  assert.deepEqual(list.map((x) => x.id), ['c', 'd', 'b', 'a', 'e']);
  assert.deepEqual(list.map((x) => x.state), ['today', 'future', 'future', 'past', 'past']);
  assert.equal(list[0].days, 0);
  assert.equal(list[1].days, 16);
  assert.equal(list[2].days, 107);
  assert.equal(list[3].days, -5);
  assert.equal(sortedCountdowns(null, '2026-09-04').length, 0);
});

test('trayCountdownSuffix: disabled or empty returns empty; enabled picks nearest future', () => {
  const list = [
    { id: 'a', name: '考研', date: '2026-12-20' },
    { id: 'b', name: '月考', date: '2026-09-20' },
    { id: 'c', name: '已过', date: '2026-08-01' }
  ];
  assert.equal(trayCountdownSuffix(list, '2026-09-04', false), '');
  assert.equal(trayCountdownSuffix([], '2026-09-04', true), '');
  assert.equal(trayCountdownSuffix(list, '2026-09-04', true), ' ⏳16');
  // 全部过期时不显示
  assert.equal(trayCountdownSuffix([list[2]], '2026-09-04', true), '');
});
