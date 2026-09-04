const test = require('node:test');
const assert = require('node:assert/strict');
const session = require('../src/renderer/shared/session-model.js');

/* 2026-09-02 是周三；本周（周一锚点）= 2026-08-31 .. 2026-09-06 */

test('countFromOf: pre-gate days count in full, gated days count nothing, checked-in days count from check-in', () => {
  const state = {
    gateStart: '2026-09-01',
    checkins: { '2026-09-02': { at: '2026-09-02T05:00:00', from: 14 * 3600 + 5 * 60 } }
  };
  assert.equal(session.countFromOf(state, '2026-08-31'), 0);   // 门禁启用前：全天计
  assert.equal(session.countFromOf({}, '2026-09-02'), 0);      // 未启用门禁：全天计
  assert.equal(session.countFromOf(state, '2026-09-01'), session.DAY_END); // 启用后未打卡：不计
  assert.equal(session.countFromOf(state, '2026-09-02'), 14 * 3600 + 5 * 60); // 已打卡：起算秒
  assert.equal(session.countFromOf({ gateStart: '2026-09-01', checkins: { '2026-09-02': { from: 'x' } } }, '2026-09-02'), session.DAY_END); // 非法 from 视为未打卡
  assert.equal(session.countFromOf({ gateStart: '2026-09-01', checkins: { '2026-09-02': { from: 99999 } } }, '2026-09-02'), session.DAY_END); // 越界钳到不计
});

test('gateActive / checkedIn classify days consistently', () => {
  const state = { gateStart: '2026-09-01', checkins: { '2026-09-02': { at: 'x', from: 0 } } };
  assert.equal(session.gateActive(state, '2026-09-01'), true);
  assert.equal(session.gateActive(state, '2026-09-02'), false);
  assert.equal(session.gateActive(state, '2026-08-31'), false); // 门禁前永远不算拦
  assert.equal(session.checkedIn(state, '2026-09-02'), true);
  assert.equal(session.checkedIn(state, '2026-09-01'), false);
  assert.equal(session.checkedIn(state, '2026-08-31'), false);
});

test('weekStartOf anchors weeks on Monday', () => {
  assert.equal(session.weekStartOf('2026-09-02'), '2026-08-31'); // 周三 → 本周一
  assert.equal(session.weekStartOf('2026-08-31'), '2026-08-31'); // 周一 → 自身
  assert.equal(session.weekStartOf('2026-09-06'), '2026-08-31'); // 周日 → 本周一
  assert.equal(session.weekStartOf('2026-08-30'), '2026-08-24'); // 上周日 → 上周一
  assert.equal(session.weekStartOf('bad'), null);
});

test('rest voucher price doubles within the week and resets on Monday', () => {
  const now = new Date(2026, 8, 2, 20, 0); // 2026-09-02 周三晚
  const spend = (day, kind) => ({ kind, name: 'x', cost: 200, at: new Date(2026, 8, day, 12, 0).toISOString() });
  assert.deepEqual(session.restVoucherState([], now), { count: 0, price: 200 });
  assert.deepEqual(session.restVoucherState([spend(1, 'rest')], now), { count: 1, price: 400 });
  assert.deepEqual(session.restVoucherState([spend(1, 'rest'), spend(2, 'rest')], now), { count: 2, price: 800 });
  // 上周日（2026-08-30）的休息券不进本周阶梯
  assert.deepEqual(session.restVoucherState([spend(-1, 'rest')], now), { count: 0, price: 200 });
  // 自定义奖励的消费不影响阶梯
  assert.deepEqual(session.restVoucherState([{ id: 'r1', cost: 800, at: spend(1).at }], now), { count: 0, price: 200 });
  // 跨周重置：到了下周一，上次的兑换不再计数
  const nextMonday = new Date(2026, 8, 7, 9, 0);
  assert.deepEqual(session.restVoucherState([spend(1, 'rest'), spend(2, 'rest')], nextMonday), { count: 0, price: 200 });
});
