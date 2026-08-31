(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.StudyTimerShared = Object.assign(root.StudyTimerShared || {}, api);
})(typeof window !== 'undefined' ? window : globalThis, function () {
  function listFor(state, date) { return (((state || {}).skips || {})[date] || []).filter((x) => x && x.key); }
  function rangeFor(skip, fmtClock, atText) { return skip.start != null && skip.end != null ? fmtClock(skip.start) + ' – ' + fmtClock(skip.end) : (skip.at != null ? atText(fmtClock(skip.at)) : ''); }
  return { listFor, rangeFor };
});
