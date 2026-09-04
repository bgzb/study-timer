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

test('countFrom cutoff: blocks before check-in contribute nothing', () => {
  // 09:00 学习 40 分钟 + 休息 10 + 学习 40；打卡于 09:20（块进行中）
  const day = schedule.expandDay([{ name: 'A', start: '09:00', seq: [40, 10, 40] }], []);
  const checkin = 9 * 3600 + 20 * 60;
  const end = 11 * 3600 + 30 * 60;
  const full = stats.computeStats(day, {}, end, null);
  const cut = stats.computeStats(day, {}, end, null, checkin);
  assert.equal(full.focusMin, 80);          // 不传 countFrom：全天计（向后兼容）
  assert.equal(cut.focusMin, 60);           // 少掉打卡前的 20 分钟
  assert.equal(cut.done, 2);                // 首块打卡后（09:20）自然走完、未跳过，仍算完成；打卡前整块结束的才不算
  assert.equal(full.done, 2);
  // 未打卡（countFrom = DAY_END）：整天不计
  const gated = stats.computeStats(day, {}, end, null, 86399);
  assert.deepEqual([gated.focusMin, gated.done, gated.total], [0, 0, 2]);
});

test('snapshot honors countFrom: pre-checkin blocks are excluded from the day record', () => {
  const day = schedule.expandDay([{ name: 'A', start: '09:00', seq: [40, 10, 40] }], []);
  const checkin = 9 * 3600 + 45 * 60; // 首块结束后才打卡
  const end = 11 * 3600 + 30 * 60;
  const snap = stats.snapshot(day, { blocks: {}, skips: {} }, end, '2026-09-02', checkin);
  assert.equal(snap.focusMin, 40);                       // 只剩第二块
  assert.deepEqual(snap.blocks.map((b) => b.s), [9 * 3600 + 50 * 60]); // 第二块从原定 09:50 开始；打卡前的块不入档
  const full = stats.snapshot(day, { blocks: {}, skips: {} }, end, '2026-09-02');
  assert.equal(full.focusMin, 80);                       // 不传起算点：旧行为不变
});
