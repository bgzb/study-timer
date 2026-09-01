(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.StudyTimerShared = Object.assign(root.StudyTimerShared || {}, api);
})(typeof window !== 'undefined' ? window : globalThis, function () {
  function anchorPoolFor(session, block) {
    if (session && session.isExtra) return 'extraStart';
    if (block && block.bIdx > 0) return 'study';
    const name = (session && session.name) || '';
    if (/上午|早上|早间|晨|morning/i.test(name)) return 'morningFirst';
    if (/下午|午后|afternoon/i.test(name)) return 'afternoonFirst';
    if (/晚|夜|evening|night/i.test(name)) return 'eveningFirst';
    if (session && session.idx === 0) return 'morningFirst';
    if (session && session.idx === 1) return 'afternoonFirst';
    return 'eveningFirst';
  }

  function poolForState(st) {
    if (st && st.phase === 'study') return anchorPoolFor(st.session, st.block);
    if (st && (st.phase === 'break' || st.phase === 'gap')) return 'break';
    if (st && st.phase === 'wait') return st.prev ? 'sessionEnd' : anchorPoolFor(st.next, null);
    return 'dayDone';
  }
  function quoteForState(st, pick) {
    const q = typeof pick === 'function' ? pick(poolForState(st)) : '';
    return st && st.phase === 'wait' && st.prev ? q.replace('{session}', st.prev.name || '') : q;
  }
  return { anchorPoolFor, poolForState, quoteForState };
});
