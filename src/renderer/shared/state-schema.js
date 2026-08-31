(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.StudyTimerShared = Object.assign(root.StudyTimerShared || {}, api);
})(typeof window !== 'undefined' ? window : globalThis, function () {
  const STORE_KEY = 'studyTimer.v1';
  const HOLIDAY_TABLE_VERSION = 20261110;
  const dateRange = (y1, m1, d1, y2, m2, d2, name) => {
    const out = {}, d = new Date(y1, m1 - 1, d1), end = new Date(y2, m2 - 1, d2);
    while (d <= end) { const k = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); out[k] = name; d.setDate(d.getDate() + 1); }
    return out;
  };
  const BUILTIN_HOLIDAYS = Object.assign(
    dateRange(2025, 1, 1, 2025, 1, 1, '元旦'), dateRange(2025, 1, 28, 2025, 2, 4, '春节'),
    dateRange(2025, 4, 4, 2025, 4, 6, '清明节'), dateRange(2025, 5, 1, 2025, 5, 5, '劳动节'),
    dateRange(2025, 5, 31, 2025, 6, 2, '端午节'), dateRange(2025, 10, 1, 2025, 10, 8, '国庆节·中秋'),
    dateRange(2026, 1, 1, 2026, 1, 3, '元旦'), dateRange(2026, 2, 15, 2026, 2, 23, '春节'),
    dateRange(2026, 4, 4, 2026, 4, 6, '清明节'), dateRange(2026, 5, 1, 2026, 5, 5, '劳动节'),
    dateRange(2026, 6, 19, 2026, 6, 21, '端午节'), dateRange(2026, 9, 25, 2026, 9, 27, '中秋节'),
    dateRange(2026, 10, 1, 2026, 10, 7, '国庆节'));
  const BUILTIN_MAKEUP = { '2025-01-26': '春节', '2025-02-08': '春节', '2025-04-27': '劳动节', '2025-09-28': '国庆节', '2025-10-11': '国庆节', '2026-01-04': '元旦', '2026-02-14': '春节', '2026-02-28': '春节', '2026-05-09': '劳动节', '2026-09-20': '国庆节', '2026-10-10': '国庆节' };
  const DEFAULT_SCHEDULES = {
    workday: [{ name: '上午', start: '09:00', seq: [40, 10, 40] }, { name: '下午', start: '14:00', seq: [40, 10, 40, 10, 40] }, { name: '晚上', start: '20:00', seq: [40, 10, 40] }],
    weekend: [{ name: '上午', start: '09:00', seq: [40, 10, 40] }, { name: '下午', start: '14:00', seq: [40, 10, 40, 10, 40] }, { name: '晚上', start: '20:00', seq: [40, 10, 40] }],
    holiday: [{ name: '上午', start: '09:00', seq: [40, 10, 40] }, { name: '下午', start: '14:00', seq: [40, 10, 40, 10, 40] }, { name: '晚上', start: '20:00', seq: [40, 10, 40] }]
  };
  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function defaultState() { return { language: 'zh', schedules: clone(DEFAULT_SCHEDULES), holidays: Object.assign({}, BUILTIN_HOLIDAYS), makeup: Object.assign({}, BUILTIN_MAKEUP), holidayTableVersion: HOLIDAY_TABLE_VERSION, quotes: {}, notifications: true, sound: 'chime', volume: 0.7, override: {}, skips: {}, extra: {}, dailyStats: {}, blocks: {}, journal: {}, summaryDismissed: {}, enableAck: false }; }
  function ensureState(saved) {
    const state = defaultState();
    if (saved && typeof saved === 'object' && !Array.isArray(saved)) Object.assign(state, saved);
    if (!state.schedules || typeof state.schedules !== 'object') state.schedules = clone(DEFAULT_SCHEDULES);
    for (const key of ['holidays', 'makeup', 'override', 'skips', 'extra', 'dailyStats', 'blocks', 'journal', 'summaryDismissed']) if (!state[key] || typeof state[key] !== 'object') state[key] = {};
    if (!state.quotes || typeof state.quotes !== 'object') state.quotes = {};
    if ((saved && saved.holidayTableVersion || 0) < HOLIDAY_TABLE_VERSION) {
      Object.keys(BUILTIN_HOLIDAYS).forEach((k) => { if (!(k in state.holidays)) state.holidays[k] = BUILTIN_HOLIDAYS[k]; });
      Object.keys(BUILTIN_MAKEUP).forEach((k) => { if (!(k in state.makeup)) state.makeup[k] = BUILTIN_MAKEUP[k]; });
      state.holidayTableVersion = HOLIDAY_TABLE_VERSION;
    }
    return state;
  }
  return { STORE_KEY, HOLIDAY_TABLE_VERSION, BUILTIN_HOLIDAYS, BUILTIN_MAKEUP, DEFAULT_SCHEDULES, defaultState, ensureState };
});
