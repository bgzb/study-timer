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

function anchorPoolFor(session, block) {
  if (session && session.isExtra) return 'extraStart';
  if (block.bIdx > 0) return 'study';
  const name = (session && session.name) || '';
  if (/上午|早上|早间|晨|morning/i.test(name)) return 'morningFirst';
  if (/下午|午后|afternoon/i.test(name)) return 'afternoonFirst';
  if (/晚|夜|evening|night/i.test(name)) return 'eveningFirst';
  if (session && session.idx === 0) return 'morningFirst';
  if (session && session.idx === 1) return 'afternoonFirst';
  return 'eveningFirst';
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
  if (st.phase === 'study') return anchorPoolFor(st.session, st.block);
  if (st.phase === 'break' || st.phase === 'gap') return 'break';
  if (completedExtraSessionOf(st)) return 'extraEnd';
  if (st.phase === 'wait') return 'sessionEnd';
  return 'dayDone';
}
