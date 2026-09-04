const test = require('node:test');
const assert = require('node:assert/strict');
const { defaultState, ensureState, STORE_KEY } = require('../src/renderer/shared/state-schema.js');

test('state schema keeps unknown fields for forward compatibility', () => {
  const state = ensureState({ futureFeature: { enabled: true }, language: 'en' });
  assert.equal(STORE_KEY, 'studyTimer.v1');
  assert.deepEqual(state.futureFeature, { enabled: true });
  assert.equal(state.language, 'en');
  assert.ok(state.schedules.workday.length > 0);
});

test('default state creates independent nested objects', () => {
  const a = defaultState();
  const b = defaultState();
  a.schedules.workday[0].seq[0] = 99;
  assert.notEqual(a.schedules.workday[0].seq[0], b.schedules.workday[0].seq[0]);
});

test('check-in gate fields get safe defaults without touching saved data', () => {
  const state = ensureState({ checkins: { '2026-09-02': { at: 'x', from: 100 } } });
  assert.deepEqual(state.checkins, { '2026-09-02': { at: 'x', from: 100 } }); // 已有打卡记录保持原样
  assert.equal(state.gateStart, '');
  const broken = ensureState({ checkins: 'bad', gateStart: 42 });
  assert.deepEqual(broken.checkins, {});   // 非法类型回落默认
  assert.equal(broken.gateStart, '');
  assert.deepEqual(defaultState().checkins, {});
});

test('achievement points ledger gets safe defaults without touching saved data', () => {
  const state = ensureState({ achievements: { unlockedAt: { total_10h: '2026-09-01' } } });
  assert.deepEqual(state.achievements.unlockedAt, { total_10h: '2026-09-01' }); // 已有解锁记录保持原样
  assert.deepEqual(state.achievements.points, {});                              // 积分账本补默认
  const broken = ensureState({ achievements: { unlockedAt: 'bad', points: [] } });
  assert.deepEqual(broken.achievements.unlockedAt, {});
  assert.deepEqual(broken.achievements.points, {});
  assert.deepEqual(defaultState().achievements, { unlockedAt: {}, points: {} });
});
