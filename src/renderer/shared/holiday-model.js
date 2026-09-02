(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.StudyTimerShared = Object.assign(root.StudyTimerShared || {}, api);
})(typeof window !== 'undefined' ? window : globalThis, function () {
  const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

  // 解析 NateScarlet/holiday-cn 的年度 JSON（数据来源为国务院公告）：
  // { year, days: [{ name, date, isOffDay }] }；isOffDay=true 放假、false 补班。
  // 未发布年份 days 为空数组，视为无数据返回 null。
  function parseHolidayCn(json, expectedYear) {
    if (!json || typeof json !== 'object' || json.year !== expectedYear) return null;
    if (!Array.isArray(json.days) || !json.days.length) return null;
    const holidays = {}, makeup = {};
    for (const d of json.days) {
      // 跨年调休会出现相邻年份的边界日（如 2023 数据含 2022-12-31），更远的年份视为脏数据
      if (!d || !DATE_RE.test(d.date)) return null;
      const dy = +d.date.slice(0, 4);
      if (dy < expectedYear - 1 || dy > expectedYear + 1) return null;
      if (typeof d.name !== 'string' || !d.name.trim() || typeof d.isOffDay !== 'boolean') return null;
      (d.isOffDay ? holidays : makeup)[d.date] = d.name.trim();
    }
    if (!Object.keys(holidays).length) return null;
    return { year: expectedYear, holidays, makeup };
  }

  function recordFor(state, year) { return ((state || {}).holidaySync || {})[String(year)] || null; }

  // 每天重拉一次：公告可能修订（如节假日安排调整），跨天后 at 记录失效
  function needsSync(state, year, now) {
    const rec = recordFor(state, year);
    if (!rec || !Array.isArray(rec.keys)) return true;
    return rec.day !== localDay(now);
  }

  function localDay(d) {
    const p = (n) => (n < 10 ? '0' : '') + n;
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }

  // 同步当年与明年：明年的安排通常 11 月前后发布，未发布时数据源 days 为空，直接跳过
  function yearsToFetch(now) { return [now.getFullYear(), now.getFullYear() + 1]; }

  // 把某年远程数据并入 state：只覆盖"内置表 + 上次同步"注入过的键，用户手添的条目不动；
  // 键清单记入 holidaySync，下次同步按它精确回收，避免误删用户数据
  function mergeYearIntoState(state, fetched, builtinHolidays, builtinMakeup, now) {
    if (!state.holidays || typeof state.holidays !== 'object') state.holidays = {};
    if (!state.makeup || typeof state.makeup !== 'object') state.makeup = {};
    if (!state.holidaySync || typeof state.holidaySync !== 'object') state.holidaySync = {};
    const year = fetched.year;
    const prefix = year + '-';
    const managed = new Set(recordFor(state, year) ? recordFor(state, year).keys : []);
    [builtinHolidays, builtinMakeup].forEach((table) => {
      Object.keys(table || {}).forEach((k) => { if (k.startsWith(prefix)) managed.add(k); });
    });
    managed.forEach((k) => { delete state.holidays[k]; delete state.makeup[k]; });
    Object.assign(state.holidays, fetched.holidays);
    Object.assign(state.makeup, fetched.makeup);
    state.holidaySync[String(year)] = {
      at: (now || new Date()).toISOString(),
      day: localDay(now || new Date()),
      keys: Object.keys(fetched.holidays).concat(Object.keys(fetched.makeup))
    };
    return true;
  }

  // 过往年份的节假日/补班对作息不再有任何作用，清掉避免设置页常年堆着旧年份
  function prunePastYears(state, currentYear) {
    let changed = false;
    ['holidays', 'makeup'].forEach((key) => {
      Object.keys(state[key] || {}).forEach((k) => {
        if (DATE_RE.test(k) && +k.slice(0, 4) < currentYear) { delete state[key][k]; changed = true; }
      });
    });
    if (state.holidaySync) {
      Object.keys(state.holidaySync).forEach((y) => {
        if (DATE_RE.test(y + '-01-01') && +y < currentYear) { delete state.holidaySync[y]; changed = true; }
      });
    }
    return changed;
  }

  return { parseHolidayCn, needsSync, yearsToFetch, mergeYearIntoState, prunePastYears };
});
