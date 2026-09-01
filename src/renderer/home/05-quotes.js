/* ==================== 激励语 ==================== */

const lastQuoteIdx = {};

function pickQuote(poolId) {
  const lang = state.language === 'en' ? 'en' : 'zh';
  const pools = state.quotes[lang] || state.quotes.zh || {};
  const pool = pools[poolId] && pools[poolId].length ? pools[poolId] : [lang === 'en' ? 'Keep going!' : '坚持就是胜利。'];
  let idx = Math.floor(Math.random() * pool.length);
  if (pool.length > 1 && idx === lastQuoteIdx[poolId]) idx = (idx + 1) % pool.length;
  lastQuoteIdx[poolId] = idx;
  return pool[idx];
}

function completedExtraSessionOf(st) {
  if (!day || !day.sess.length) return null;
  let session = null;
  if (st.phase === 'wait') session = st.prev;
  else if (st.phase === 'done') session = day.sess[day.sess.length - 1];
  if (!session || !session.isExtra) return null;
  const blocks = day.blocks.filter((b) => b.sIdx === session.idx);
  return blocks.length && blocks.every((b) => b.effEnd >= b.end) ? session : null;
}

function currentPoolOf(st) {
  if (st.phase === 'study') return StudyTimerShared.anchorPoolFor(st.session, st.block);
  if (st.phase === 'break' || st.phase === 'gap') return 'break';
  if (completedExtraSessionOf(st)) return 'extraEnd';
  return StudyTimerShared.poolForState(st);
}
