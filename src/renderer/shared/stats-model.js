(function (root, factory) {
  const api = factory(root.StudyTimerShared || {});
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.StudyTimerShared = Object.assign(root.StudyTimerShared || {}, api);
})(typeof window !== 'undefined' ? window : globalThis, function (shared) {
  const focusOf = shared.focusFlagOf || function (block, edits) { const edit = edits && edits[block.key]; return edit && edit.focus !== undefined ? !!edit.focus : block.type === 'study'; };
  function computeStats(day, edits, nowAt, dateStr) {
    const now = nowAt == null ? 0 : nowAt; let done = 0, total = 0, focusMin = 0;
    for (const b of (day && day.blocks) || []) {
      if (b.type !== 'study') continue;
      total++;
      if (focusOf(b, edits)) { const finished = Math.min(b.effEnd, now); if (finished > b.start) focusMin += (finished - b.start) / 60; }
      if (b.effEnd <= now && b.effEnd >= b.end) done++;
    }
    return { done, total, focusMin: Math.round(focusMin), date: dateStr || null };
  }
  function computeRecap(day, edits, settleAt) {
    const now = settleAt == null ? 86399 : settleAt, stats = computeStats(day, edits, now);
    let skipped = 0;
    for (const b of (day && day.blocks) || []) if (b.type === 'study' && b.effEnd <= now && b.effEnd < b.end) skipped++;
    return Object.assign(stats, { skipped });
  }
  function snapshot(day, state, nowAt, dateStr) {
    const now = nowAt == null ? 0 : nowAt, edits = ((state || {}).blocks || {})[dateStr] || {}, skips = (((state || {}).skips || {})[dateStr]) || [];
    const stats = computeStats(day, edits, now, dateStr), blocks = [], skipped = { value: 0 };
    for (const b of (day && day.blocks) || []) {
      if (b.type !== 'study' || b.effEnd > now) continue;
      const wasSkipped = b.effEnd < b.end; if (wasSkipped) skipped.value++;
      const sr = wasSkipped ? skips.find((x) => x.key === b.key) : null, ed = edits[b.key];
      blocks.push({ s: b.start, e: b.effEnd, min: Math.round(((b.effEnd - b.start) / 60) * 10) / 10, sk: wasSkipped || undefined, r: (sr && sr.reason) || undefined, act: (ed && ed.act) || undefined, note: (ed && ed.note) || undefined, f: ed && ed.focus === false ? false : undefined });
    }
    return { focusMin: stats.focusMin, done: stats.done, total: stats.total, skipped: skipped.value, blocks };
  }
  return { computeStats, computeRecap, snapshot };
});
