(function (root, factory) {
  const api = factory(root.StudyTimerShared || {});
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.StudyTimerShared = Object.assign(root.StudyTimerShared || {}, api);
})(typeof window !== 'undefined' ? window : globalThis, function (shared) {
  const clockMinutes = shared.clockMinutes || function (value) { const m = String(value || '').match(/^(\d{1,2}):(\d{2})$/); if (!m) return NaN; const h = Number(m[1]), min = Number(m[2]); return h <= 23 && min <= 59 ? h * 60 + min : NaN; };
  const fmtClock = shared.fmtClock || ((sec) => String(Math.floor(sec / 3600)).padStart(2, '0') + ':' + String(Math.floor((sec % 3600) / 60)).padStart(2, '0'));
  function modeFor(dateStr, state) { const [y, m, d] = String(dateStr).split('-').map(Number); const dow = new Date(y, m - 1, d).getDay(); const ov = (state.override || {})[dateStr]; if (ov) return ov; if ((state.makeup || {})[dateStr]) return 'workday'; if ((state.holidays || {})[dateStr]) return 'holiday'; return dow === 0 || dow === 6 ? 'weekend' : 'workday'; }
  function extraSessionOf(x, title) { if (!x) return null; const start = clockMinutes(x.start), end = clockMinutes(x.end); if (!x.id || !Number.isFinite(start) || !Number.isFinite(end) || start >= end) return null; return { id: String(x.id), title: String(x.title || title || '加钟').trim().slice(0, 40) || '加钟', start: fmtClock(start * 60), end: fmtClock(end * 60) }; }
  function normalizeExtraData(data) { const out = {}; if (!data || typeof data !== 'object' || Array.isArray(data)) return out; Object.keys(data).forEach((date) => { if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Array.isArray(data[date])) return; const items = data[date].map((x) => extraSessionOf(x)).filter(Boolean); if (items.length) out[date] = items; }); return out; }
  function mergeExtraSessions(sessions, extras, title) { const out = (sessions || []).map((s, i) => Object.assign({}, s, { _k: i, isExtra: false })); (extras || []).forEach((x) => { const e = extraSessionOf(x, title); if (e) out.push({ _k: 'x' + e.id, name: e.title, start: e.start, end: e.end, seq: [clockMinutes(e.end) - clockMinutes(e.start)], isExtra: true }); }); return out.sort((a, b) => clockMinutes(a.start) - clockMinutes(b.start) || String(a._k).localeCompare(String(b._k))); }
  /* windDownAt：收工生效中的当天秒（无则 null）。收工只影响非加钟块——
     未开始的整块标 off（不参与统计与相位，时间轴灰显）；进行中块截到收工时刻并标 wd
     （如实记录已学时间，但不算完成也不算跳过）。加钟块只截断、永不剔除，收工后加钟照常计数 */
  function expandDay(sessions, skips, windDownAt) {
    const blocks = [], sess = [], skipList = skips || [];
    const wd = Number.isFinite(+windDownAt) && +windDownAt > 0 ? Math.floor(+windDownAt) : null;
    (sessions || []).forEach((s, i) => {
      const parts = String(s.start).split(':').map(Number); let t = ((parts[0] || 0) * 60 + (parts[1] || 0)) * 60; const sStart = t;
      (s.seq || []).forEach((mins, j) => {
        const start = t, end = start + mins * 60, key = (s._k !== undefined ? s._k : i) + '-' + j, b = { key, type: j % 2 === 0 ? 'study' : 'break', start, end, sIdx: i, bIdx: j, minutes: mins, isExtra: !!s.isExtra };
        const sk = skipList.find((x) => x.key === key);
        b.effEnd = sk ? Math.max(start, Math.min(end, sk.at)) : end;
        if (wd !== null && b.effEnd > wd) {
          // 加钟只有分钟粒度：收工同一分钟内新增的加钟视为收工之后，不截断
          const bound = b.isExtra ? Math.floor(wd / 60) * 60 : wd;
          if (start >= bound) { if (!b.isExtra) b.off = true; }
          else { b.effEnd = wd; b.wd = true; }
        }
        blocks.push(b); t = end;
      });
      sess.push({ idx: i, name: s.name, start: sStart, end: t, key: s._k !== undefined ? s._k : i, isExtra: !!s.isExtra });
    });
    return { blocks, sess };
  }
  function focusFlagOf(block, edits) { const edit = edits && edits[block.key]; return edit && edit.focus !== undefined ? !!edit.focus : block.type === 'study'; }
  function currentState(day, nowSeconds) {
    const now = typeof nowSeconds === 'function' ? nowSeconds() : Number(nowSeconds || 0);
    const blocks = ((day && day.blocks) || []).filter((b) => !b.off); // 收工剔除的块不参与相位判定
    for (const b of blocks) if (b.start <= now && now < b.effEnd) return { phase: b.type, block: b, session: day.sess[b.sIdx] };
    if (!day || !day.sess.length) return { phase: 'done' };
    if (now < day.sess[0].start) return { phase: 'wait', next: day.sess[0] };
    const next = blocks.find((b) => b.start > now);
    if (next) {
      const currentIndex = day.sess.reduce((acc, session, i) => (session.start <= now ? i : acc), -1);
      if (next.sIdx === currentIndex) {
        const bi = blocks.indexOf(next);
        const gapStart = bi > 0 ? blocks[bi - 1].effEnd : next.start;
        return { phase: 'gap', next, gapStart, session: day.sess[currentIndex] };
      }
      return { phase: 'wait', next: day.sess[next.sIdx], prev: currentIndex >= 0 ? day.sess[currentIndex] : undefined };
    }
    return { phase: 'done' };
  }
  return { modeFor, extraSessionOf, normalizeExtraData, mergeExtraSessions, expandDay, currentState, focusFlagOf };
});
