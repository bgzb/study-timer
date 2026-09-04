(function (root, factory) {
  const api = factory(root.StudyTimerShared || {});
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.StudyTimerShared = Object.assign(root.StudyTimerShared || {}, api);
})(typeof window !== 'undefined' ? window : globalThis, function () {
  /* ==================== 每日打卡门禁 + 阶梯休息券（纯函数） ==================== */

  const DAY_END = 86399;
  const REST_VOUCHER_BASE = 200;

  const pad2 = (n) => String(n).padStart(2, '0');
  function parseYmd(str) {
    const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(String(str || ''));
    if (!m) return null;
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return isNaN(d.getTime()) ? null : d;
  }
  function fmtYmd(d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }

  /* 计数起点（当天秒数）：gateStart 之前或未启用 → 0（历史日全天计，旧数据零影响）；
     启用后未打卡 → DAY_END（整天不计）；已打卡 → 打卡记录的 from */
  function countFromOf(stateLike, dateStr) {
    if (!dateStr) return 0;
    const s = stateLike || {};
    if (!s.gateStart || dateStr < s.gateStart) return 0;
    const ci = (s.checkins || {})[dateStr];
    if (!ci || typeof ci !== 'object') return DAY_END;
    const from = Number(ci.from);
    if (!Number.isFinite(from) || from < 0) return DAY_END;
    return Math.min(DAY_END, Math.floor(from));
  }

  /* 门禁是否拦着这天（启用打卡且尚未打卡） */
  function gateActive(stateLike, dateStr) {
    return countFromOf(stateLike, dateStr) >= DAY_END;
  }
  function checkedIn(stateLike, dateStr) {
    const ci = ((stateLike || {}).checkins || {})[dateStr];
    return !!(ci && typeof ci === 'object' && Number.isFinite(Number(ci.from)));
  }

  /* 周界：周一锚点（与成就 full_week / 热力图的周口径一致） */
  function weekStartOf(dateStr) {
    const d = parseYmd(dateStr);
    if (!d) return null;
    d.setDate(d.getDate() - (d.getDay() + 6) % 7);
    return fmtYmd(d);
  }

  /* 阶梯休息券：本周（周一重置）每兑换一次价格翻倍，200 → 400 → 800 → …
     只统计 kind === 'rest' 的消费，自定义奖励不影响阶梯 */
  function restVoucherState(spends, now) {
    const nowDate = now instanceof Date ? now : new Date();
    const wk = weekStartOf(fmtYmd(nowDate));
    let count = 0;
    for (const x of Array.isArray(spends) ? spends : []) {
      if (!x || x.kind !== 'rest') continue;
      const d = new Date(x.at);
      if (isNaN(d.getTime())) continue;
      if (weekStartOf(fmtYmd(d)) === wk) count++;
    }
    return { count, price: REST_VOUCHER_BASE * Math.pow(2, count) };
  }

  return { DAY_END, REST_VOUCHER_BASE, countFromOf, gateActive, checkedIn, weekStartOf, restVoucherState };
});
