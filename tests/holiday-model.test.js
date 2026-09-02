const test = require('node:test');
const assert = require('node:assert/strict');
const model = require('../src/renderer/shared/holiday-model.js');

const CN_2027 = {
  year: 2027,
  papers: ['https://www.gov.cn/xxx.htm'],
  days: [
    { name: '元旦', date: '2027-01-01', isOffDay: true },
    { name: '元旦', date: '2027-01-02', isOffDay: true },
    { name: '元旦', date: '2026-12-31', isOffDay: false },
    { name: '春节', date: '2027-02-06', isOffDay: true },
    { name: '春节', date: '2027-02-20', isOffDay: false }
  ]
};

test('parseHolidayCn splits official days into holidays and makeup', () => {
  const r = model.parseHolidayCn(CN_2027, 2027);
  assert.deepEqual(r.holidays, { '2027-01-01': '元旦', '2027-01-02': '元旦', '2027-02-06': '春节' });
  assert.deepEqual(r.makeup, { '2026-12-31': '元旦', '2027-02-20': '春节' });
});

test('parseHolidayCn rejects unpublished years and malformed payloads', () => {
  assert.equal(model.parseHolidayCn({ year: 2028, days: [] }, 2028), null);
  assert.equal(model.parseHolidayCn({ year: 2026, days: [] }, 2027), null); // 年份不符
  assert.equal(model.parseHolidayCn(null, 2027), null);
  assert.equal(model.parseHolidayCn({ year: 2027, days: [{ name: 'x', date: '2027-01-01' }] }, 2027), null); // 缺 isOffDay
  assert.equal(model.parseHolidayCn({ year: 2027, days: [{ name: 'x', date: '2024-01-01', isOffDay: true }] }, 2027), null); // 年份相差超过 1
});

test('yearsToFetch covers current and next year', () => {
  assert.deepEqual(model.yearsToFetch(new Date(2026, 8, 2)), [2026, 2027]);
  assert.deepEqual(model.yearsToFetch(new Date(2027, 11, 31)), [2027, 2028]);
});

test('needsSync is true without a record and after the day rolls over', () => {
  const state = { holidaySync: { '2026': { at: '2026-09-01T01:00:00Z', day: '2026-09-01', keys: ['2026-01-01'] } } };
  assert.equal(model.needsSync(state, 2027, new Date(2026, 8, 2)), true);
  assert.equal(model.needsSync(state, 2026, new Date(2026, 8, 2)), true); // day 不一致
  assert.equal(model.needsSync({ holidaySync: { '2026': { day: '2026-09-02', keys: [] } } }, 2026, new Date(2026, 8, 2)), false);
  assert.equal(model.needsSync({}, 2026, new Date(2026, 8, 2)), true);
});

test('mergeYearIntoState replaces builtin/synced keys but keeps user-added ones', () => {
  const builtinHolidays = { '2026-10-01': '国庆节', '2026-10-02': '国庆节', '2026-10-03': '国庆节' };
  const builtinMakeup = { '2026-09-20': '国庆节' };
  const state = {
    holidays: { '2026-10-01': '国庆节', '2026-10-02': '国庆节', '2026-10-03': '国庆节', '2026-12-25': '自定义' },
    makeup: { '2026-09-20': '国庆节', '2026-12-26': '自定义' },
    holidaySync: {}
  };
  const fetched = { year: 2026, holidays: { '2026-10-01': '国庆节', '2026-10-02': '国庆节' }, makeup: { '2026-09-20': '国庆节' } };
  model.mergeYearIntoState(state, fetched, builtinHolidays, builtinMakeup, new Date(2026, 8, 2));

  // 内置 10-03 未出现在官方数据里 → 被回收；用户手添的 12-25 / 12-26 保留
  assert.deepEqual(state.holidays, { '2026-10-01': '国庆节', '2026-10-02': '国庆节', '2026-12-25': '自定义' });
  assert.deepEqual(state.makeup, { '2026-09-20': '国庆节', '2026-12-26': '自定义' });
  assert.deepEqual(state.holidaySync['2026'].keys.sort(),
    ['2026-09-20', '2026-10-01', '2026-10-02']);

  // 二次同步：上次注入的键按记录回收，再注入新数据
  const fetched2 = { year: 2026, holidays: { '2026-10-01': '国庆节' }, makeup: {} };
  model.mergeYearIntoState(state, fetched2, builtinHolidays, builtinMakeup, new Date(2026, 8, 2));
  assert.deepEqual(state.holidays, { '2026-10-01': '国庆节', '2026-12-25': '自定义' });
  assert.deepEqual(state.makeup, { '2026-12-26': '自定义' });
  assert.deepEqual(state.holidaySync['2026'].keys, ['2026-10-01']);
});

test('prunePastYears drops past-year entries and records, keeps current and future', () => {
  const state = {
    holidays: { '2025-10-01': '国庆节', '2026-01-01': '元旦', '2027-01-01': '元旦' },
    makeup: { '2025-09-28': '国庆节', '2026-01-04': '元旦' },
    holidaySync: { '2025': { day: '2025-11-10', keys: [] }, '2026': { day: '2026-09-02', keys: [] } }
  };
  const changed = model.prunePastYears(state, 2026);
  assert.equal(changed, true);
  assert.deepEqual(state.holidays, { '2026-01-01': '元旦', '2027-01-01': '元旦' });
  assert.deepEqual(state.makeup, { '2026-01-04': '元旦' });
  assert.deepEqual(Object.keys(state.holidaySync), ['2026']);
  assert.equal(model.prunePastYears(state, 2026), false); // 已干净时不再报变更
});
