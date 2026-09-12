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

/* ===== 收工（wind-down） ===== */

const H = 3600;

test('wind-down truncates the running block, drops future planned blocks but keeps extra sessions', () => {
  // 09:00 学习40 休息10 学习40 + 加钟 11:00–11:30；09:30 收工（首块进行中）
  const sessions = schedule.mergeExtraSessions(
    [{ name: 'A', start: '09:00', seq: [40, 10, 40] }],
    [{ id: 'x1', start: '11:00', end: '11:30' }]);
  const wdAt = 9 * H + 30 * 60;
  const day = schedule.expandDay(sessions, [], wdAt);
  const [b0, b1, b2, bx] = day.blocks;
  assert.equal(b0.effEnd, wdAt);
  assert.equal(b0.wd, true);
  assert.ok(!b0.off && !b0.sk);
  assert.equal(b1.off, true);
  assert.equal(b2.off, true);          // 未来计划块整块剔除，不标跳过
  assert.ok(!bx.off);                  // 加钟永不剔除
  assert.equal(bx.start, 11 * H);
  // 收工后无活跃块；因当天还有加钟，相位为等待加钟而非 done
  const idle = schedule.currentState(day, 9 * H + 40 * 60);
  assert.equal(idle.phase, 'wait');
  assert.equal(idle.next.isExtra, true);
  const st = schedule.currentState(day, 11 * H + 5 * 60);
  assert.equal(st.phase, 'study');
  assert.equal(st.block.key, bx.key);
});

test('wind-down truncates an extra session that was running at the wind-down moment', () => {
  const sessions = schedule.mergeExtraSessions(
    [{ name: 'A', start: '09:00', seq: [40] }],
    [{ id: 'x1', start: '10:00', end: '10:40' }]);
  const wdAt = 10 * H + 20 * 60; // 加钟进行中收工
  const day = schedule.expandDay(sessions, [], wdAt);
  const bx = day.blocks[1];
  assert.equal(bx.effEnd, wdAt);
  assert.equal(bx.wd, true);
  assert.equal(schedule.currentState(day, 10 * H + 30 * 60).phase, 'done');
});

test('wind-down shrinks totals and records real focus up to the wind-down moment', () => {
  const day = schedule.expandDay([{ name: 'A', start: '09:00', seq: [40, 10, 40] }], [], 9 * H + 30 * 60);
  const r = stats.computeRecap(day, {}, 12 * H);
  assert.deepEqual([r.done, r.total, r.focusMin, r.skipped], [0, 1, 30, 0]);
  const snap = stats.snapshot(day, { blocks: {}, skips: {} }, 12 * H, 'd', 0, [{ at: 9 * H + 30 * 60 }]);
  assert.equal(snap.focusMin, 30);
  assert.equal(snap.blocks.length, 1); // 只入档进行中块截到收工点的一段，无 sk 标记
  assert.ok(!snap.blocks[0].sk);
});

test('resumed wind-down excludes the idle interval from focus and completion', () => {
  // 09:00 学习40 休息10 学习40；09:30 收工、09:50 撤销 → [09:30, 09:50) 不计
  const day = schedule.expandDay([{ name: 'A', start: '09:00', seq: [40, 10, 40] }], []);
  const wd = [{ at: 9 * H + 30 * 60, undoneAt: 9 * H + 50 * 60 }];
  const r = stats.computeRecap(day, {}, 11 * H, 0, wd);
  assert.equal(r.focusMin, 70);            // 块0 计 09:00–09:30 = 30 + 块2 完整 40
  assert.deepEqual([r.done, r.total, r.skipped], [1, 2, 0]);
  const snap = stats.snapshot(day, { blocks: {}, skips: {} }, 11 * H, 'd', 0, wd);
  assert.equal(snap.focusMin, 70);
  assert.deepEqual(snap.blocks.map((b) => b.s), [9 * H, 9 * H + 50 * 60]);
});

test('a resumed wind-down interval splits a straddling study block into two records', () => {
  const day = schedule.expandDay([{ name: 'A', start: '09:00', seq: [40] }], []);
  const wd = [{ at: 9 * H + 10 * 60, undoneAt: 9 * H + 30 * 60 }];
  const snap = stats.snapshot(day, { blocks: {}, skips: {} }, 10 * H, 'd', 0, wd);
  assert.equal(snap.focusMin, 20);
  assert.deepEqual(snap.blocks.map((b) => [b.s, b.e]),
    [[9 * H, 9 * H + 10 * 60], [9 * H + 30 * 60, 9 * H + 40 * 60]]);
  assert.equal(snap.done, 0); // 被撤销区间打断的块与部分跳过同口径，不算完成
});

test('a study block entirely inside the resumed wind-down interval counts nothing', () => {
  const day = schedule.expandDay([{ name: 'A', start: '09:00', seq: [40] }], []);
  const wd = [{ at: 9 * H, undoneAt: 10 * H }];
  const r = stats.computeRecap(day, {}, 12 * H, 0, wd);
  assert.deepEqual([r.done, r.total, r.focusMin, r.skipped], [0, 1, 0, 0]);
});

test('wind down, resume, then wind down again keeps the prior exclusion and applies the new moment', () => {
  // 第二次收工于 11:00（此时块2 已自然结束）：expandDay 只带生效中的 at
  const day = schedule.expandDay([{ name: 'A', start: '09:00', seq: [40, 10, 40] }], [], 11 * H);
  const wd = [{ at: 9 * H + 30 * 60, undoneAt: 9 * H + 50 * 60 }, { at: 11 * H }];
  const r = stats.computeRecap(day, {}, 12 * H, 0, wd);
  assert.equal(r.focusMin, 70);
  assert.deepEqual([r.done, r.total], [1, 2]);
});
