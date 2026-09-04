(function (root, factory) {
  const api = factory(root.StudyTimerShared || {});
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.StudyTimerShared = Object.assign(root.StudyTimerShared || {}, api);
})(typeof window !== 'undefined' ? window : globalThis, function (shared) {
  const focusOf = shared.focusFlagOf || function (block, edits) { const edit = edits && edits[block.key]; return edit && edit.focus !== undefined ? !!edit.focus : block.type === 'study'; };
  /* countFrom：打卡起算秒（0 = 全天计）。起算点之前结束的学习块不算完成、不累计专注、不入档 */
  const normFrom = (countFrom) => (!Number.isFinite(+countFrom) || +countFrom < 0 ? 0 : Math.floor(+countFrom));
  function computeStats(day, edits, nowAt, dateStr, countFrom) {
    const now = nowAt == null ? 0 : nowAt, from = normFrom(countFrom);
    let done = 0, total = 0, focusMin = 0;
    for (const b of (day && day.blocks) || []) {
      if (b.type !== 'study') continue;
      total++;
      if (focusOf(b, edits)) { const finished = Math.min(b.effEnd, now); if (finished > Math.max(b.start, from)) focusMin += (finished - Math.max(b.start, from)) / 60; }
      if (b.effEnd <= now && b.effEnd >= b.end && b.effEnd > from) done++;
    }
    return { done, total, focusMin: Math.round(focusMin), date: dateStr || null };
  }
  function computeRecap(day, edits, settleAt, countFrom) {
    const now = settleAt == null ? 86399 : settleAt, from = normFrom(countFrom), stats = computeStats(day, edits, now, null, from);
    let skipped = 0;
    for (const b of (day && day.blocks) || []) if (b.type === 'study' && b.effEnd <= now && b.effEnd < b.end && b.effEnd > from) skipped++;
    return Object.assign(stats, { skipped });
  }
  function snapshot(day, state, nowAt, dateStr, countFrom) {
    const now = nowAt == null ? 0 : nowAt, from = normFrom(countFrom);
    const edits = ((state || {}).blocks || {})[dateStr] || {}, skips = (((state || {}).skips || {})[dateStr]) || [];
    const stats = computeStats(day, edits, now, dateStr, from), blocks = [], skipped = { value: 0 };
    for (const b of (day && day.blocks) || []) {
      if (b.type !== 'study' || b.effEnd > now) continue;
      if (b.effEnd <= from) continue; // 打卡前结束的块不在计数窗口，不入档
      const wasSkipped = b.effEnd < b.end; if (wasSkipped) skipped.value++;
      const sr = wasSkipped ? skips.find((x) => x.key === b.key) : null, ed = edits[b.key];
      const begin = Math.max(b.start, from);
      blocks.push({ s: begin, e: b.effEnd, min: Math.round(((b.effEnd - begin) / 60) * 10) / 10, sk: wasSkipped || undefined, r: (sr && sr.reason) || undefined, act: (ed && ed.act) || undefined, note: (ed && ed.note) || undefined, f: ed && ed.focus === false ? false : undefined });
    }
    return { focusMin: stats.focusMin, done: stats.done, total: stats.total, skipped: skipped.value, blocks };
  }
  return { computeStats, computeRecap, snapshot };
});
