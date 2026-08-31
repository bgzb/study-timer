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
