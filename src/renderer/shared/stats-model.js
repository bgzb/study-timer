(function (root, factory) {
  const api = factory(root.StudyTimerShared || {});
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.StudyTimerShared = Object.assign(root.StudyTimerShared || {}, api);
})(typeof window !== 'undefined' ? window : globalThis, function (shared) {
  const focusOf = shared.focusFlagOf || function (block, edits) { const edit = edits && edits[block.key]; return edit && edit.focus !== undefined ? !!edit.focus : block.type === 'study'; };
  /* countFrom：打卡起算秒（0 = 全天计）。起算点之前结束的学习块不算完成、不累计专注、不入档 */
  const normFrom = (countFrom) => (!Number.isFinite(+countFrom) || +countFrom < 0 ? 0 : Math.floor(+countFrom));
  /* 收工记录（state.windDown[date] 数组）里已撤销的剔除区间 [at, undoneAt)：
     这段时间既不算专注也不算完成（收工生效中的剔除由 expandDay 的 off/wd 标记承担，不走这里） */
  function wdExclusionsOf(wd) {
    return (Array.isArray(wd) ? wd : [])
      .filter((x) => x && Number.isFinite(+x.at) && Number.isFinite(+x.undoneAt) && +x.undoneAt > +x.at)
      .map((x) => [+x.at, +x.undoneAt]);
  }
  /* 块 [start, effEnd) 落在统计窗口 [from, now] 内、且扣除撤销区间后允许计数的区段列表 [[s,e],...] */
  function wdIntervalsOf(start, effEnd, now, from, exs) {
    const lo = Math.max(start, from), hi = Math.min(effEnd, now);
    if (hi <= lo) return [];
    let segs = [[lo, hi]];
    for (const [a, b] of exs || []) {
      const next = [];
      for (const [s, e] of segs) {
        if (b <= s || a >= e) { next.push([s, e]); continue; }
        if (a > s) next.push([s, a]);
        if (b < e) next.push([b, e]);
      }
      segs = next.filter(([s, e]) => e > s);
    }
    return segs;
  }
  function computeStats(day, edits, nowAt, dateStr, countFrom, wd) {
    const now = nowAt == null ? 0 : nowAt, from = normFrom(countFrom), exs = wdExclusionsOf(wd);
    let done = 0, total = 0, focusMin = 0;
    for (const b of (day && day.blocks) || []) {
      if (b.type !== 'study' || b.off) continue;
      total++;
      if (focusOf(b, edits)) for (const [s, e] of wdIntervalsOf(b.start, b.effEnd, now, from, exs)) focusMin += (e - s) / 60;
      // 完成块：自然走完 + 窗口内有计入时段 + 未被撤销区间打断（收工截断的块与部分跳过同口径，不算完成）
      if (b.effEnd <= now && b.effEnd >= b.end
        && !exs.some(([a, z]) => a < b.end && z > b.start)
        && wdIntervalsOf(b.start, b.end, now, from, exs).length) done++;
    }
    return { done, total, focusMin: Math.round(focusMin), date: dateStr || null };
  }
  function computeRecap(day, edits, settleAt, countFrom, wd) {
    const now = settleAt == null ? 86399 : settleAt, from = normFrom(countFrom), stats = computeStats(day, edits, now, null, from, wd);
    let skipped = 0;
    for (const b of (day && day.blocks) || []) if (b.type === 'study' && !b.off && b.effEnd <= now && b.effEnd < b.end && !b.wd && b.effEnd > from) skipped++;
    return Object.assign(stats, { skipped });
  }
  function snapshot(day, state, nowAt, dateStr, countFrom, wd) {
    const now = nowAt == null ? 0 : nowAt, from = normFrom(countFrom);
    const edits = ((state || {}).blocks || {})[dateStr] || {}, skips = (((state || {}).skips || {})[dateStr]) || [];
    const stats = computeStats(day, edits, now, dateStr, from, wd), blocks = [], skipped = { value: 0 };
    const exs = wdExclusionsOf(wd);
    for (const b of (day && day.blocks) || []) {
      if (b.type !== 'study' || b.off || b.effEnd > now) continue;
      const wasSkipped = b.effEnd < b.end && !b.wd; if (wasSkipped) skipped.value++;
      const sr = wasSkipped ? skips.find((x) => x.key === b.key) : null, ed = edits[b.key];
      // 撤销区间把块切成多段时按段入档，保持 min = (e-s)/60 且总和与 focusMin 一致
      for (const [s, e] of wdIntervalsOf(b.start, b.effEnd, now, from, exs)) {
        blocks.push({ s, e, min: Math.round(((e - s) / 60) * 10) / 10, sk: wasSkipped || undefined, r: (sr && sr.reason) || undefined, act: (ed && ed.act) || undefined, note: (ed && ed.note) || undefined, f: ed && ed.focus === false ? false : undefined });
      }
    }
    return { focusMin: stats.focusMin, done: stats.done, total: stats.total, skipped: skipped.value, blocks };
  }
  return { computeStats, computeRecap, snapshot, wdExclusionsOf, wdIntervalsOf };
});
