(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.StudyTimerShared = Object.assign(root.StudyTimerShared || {}, api);
})(typeof window !== 'undefined' ? window : globalThis, function () {
  /* 倒数日领域模型。countdowns: [{ id, name, date: 'YYYY-MM-DD' }]
   * 纯日历日差（UTC 计算，不受时区/DST 影响），不关心具体时刻。 */

  const MS_DAY = 86400000;
  function utcMidnight(dateStr) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateStr || ''));
    if (!m) return NaN;
    return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  }

  /* 目标日与今天的天数差：同一天 = 0，明天 = 1，已过为负 */
  function daysUntil(dateStr, todayStr) {
    const target = utcMidnight(dateStr), base = utcMidnight(todayStr);
    if (isNaN(target) || isNaN(base)) return NaN;
    return Math.round((target - base) / MS_DAY);
  }

  /* 前景（未到期）按剩余天数升序在前，过期项灰显排后（最近过去的在前）。
   * 每项带 days 字段与 legitness：'future' | 'today' | 'past'。非法日期项剔除。 */
  function sortedCountdowns(countdowns, todayStr) {
    const list = (Array.isArray(countdowns) ? countdowns : [])
      .map((c) => (c && c.id && typeof c.name === 'string'
        ? { id: c.id, name: c.name, date: c.date, days: daysUntil(c.date, todayStr) }
        : null))
      .filter((c) => c && !isNaN(c.days))
      .map((c) => {
        c.state = c.days > 0 ? 'future' : (c.days === 0 ? 'today' : 'past');
        return c;
      });
    const future = list.filter((c) => c.days >= 0).sort((a, b) => a.days - b.days);
    const past = list.filter((c) => c.days < 0).sort((a, b) => b.days - a.days);
    return future.concat(past);
  }

  /* 托盘标题后缀：开关开启时取最近的未到期项，如 ' ⏳87'；关/空返回 '' */
  function trayCountdownSuffix(countdowns, todayStr, enabled) {
    if (!enabled) return '';
    const list = sortedCountdowns(countdowns, todayStr).filter((c) => c.days >= 0);
    return list.length ? ' ⏳' + list[0].days : '';
  }

  return { daysUntil, sortedCountdowns, trayCountdownSuffix };
});
