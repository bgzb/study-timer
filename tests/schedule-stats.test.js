const test = require('node:test');
const assert = require('node:assert/strict');
const schedule = require('../src/renderer/shared/schedule-model.js');
const stats = require('../src/renderer/shared/stats-model.js');

test('mode selection honors override, makeup, holiday, weekend and workday', () => {
  const state = { override: { '2026-08-31': 'holiday' }, makeup: { '2026-09-06': 'workday' }, holidays: { '2026-09-01': 'holiday' } };
  assert.equal(schedule.modeFor('2026-08-31', state), 'holiday');
  assert.equal(schedule.modeFor('2026-09-06', state), 'workday');
  assert.equal(schedule.modeFor('2026-09-01', state), 'holiday');
  assert.equal(schedule.modeFor('2026-09-05', state), 'weekend');
  assert.equal(schedule.modeFor('2026-08-31', { override: {}, makeup: {}, holidays: {} }), 'workday');
});

test('extra sessions are validated, sorted and keep stable keys', () => {
  const sessions = schedule.mergeExtraSessions([{ name: 'Morning', start: '09:00', seq: [40] }], [
    { id: 'late', title: 'Late', start: '21:00', end: '21:30' },
    { id: 'bad', start: '22:00', end: '21:00' }
  ]);
  assert.deepEqual(sessions.map((x) => x._k), [0, 'xlate']);
  assert.equal(sessions[1].seq[0], 30);
});

test('skip truncates only the affected block and leaves later block scheduled', () => {
  const day = schedule.expandDay([{ name: 'A', start: '09:00', seq: [40, 10, 40] }], [{ key: '0-0', at: 9 * 3600 + 20 * 60 }]);
  assert.equal(day.blocks[0].effEnd, 9 * 3600 + 20 * 60);
  assert.equal(day.blocks[1].start, 9 * 3600 + 40 * 60);
});

test('stats honor focus override and historical settlement', () => {
  const day = schedule.expandDay([{ name: 'A', start: '09:00', seq: [40] }], []);
  const recap = stats.computeRecap(day, { '0-0': { focus: false } }, 86399);
  assert.deepEqual(recap, { done: 1, total: 1, focusMin: 0, date: null, skipped: 0 });
});
