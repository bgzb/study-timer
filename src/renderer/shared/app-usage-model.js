(function (root, factory) {
  const api = factory(root.StudyTimerShared || {});
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.StudyTimerShared = Object.assign(root.StudyTimerShared || {}, api);
})(typeof window !== 'undefined' ? window : globalThis, function (shared) {
  /* ==================== 前台应用使用（纯函数） ====================
     主进程采集器把"某时刻用户前台在用哪个应用"记为按天的区间序列
     { days: { 'YYYY-MM-DD': [{ s, e, b }] }, apps: { bundleId: 显示名 } }，
     s/e 为当天秒。归属不落盘：渲染端拿当天作息块（expandDay）把区间切成
     学习时段 / 短休 / 大休·其他 三类再聚合，作息改了历史口径跟着变。 */

  const DAY_SEC = 86400;
  const MAX_KEEP_DAYS = 400;   // 区间保留天数：超过的历史日裁掉，防 state.json 无限膨胀
  const MAX_SEGMENTS = 6000;   // 单日区间上限：极端超限时丢最旧的，保护文件体积

  const pad2 = (n) => String(n).padStart(2, '0');
  function fmtDate(d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
  function addDays(str, delta) { const p = String(str).split('-').map(Number); const d = new Date(p[0], p[1] - 1, p[2] + delta); return fmtDate(d); }

  /* 洗数据：坏区间丢弃、非法引用清空、区间按开始时间排序 */
  function normUsage(raw) {
    const out = { days: {}, apps: {} };
    if (!raw || typeof raw !== 'object') return out;
    if (raw.apps && typeof raw.apps === 'object' && !Array.isArray(raw.apps)) {
      for (const k of Object.keys(raw.apps)) {
        const bid = String(k || '').slice(0, 128);
        if (bid) out.apps[bid] = String(raw.apps[k] || bid).slice(0, 64);
      }
    }
    const days = raw.days && typeof raw.days === 'object' && !Array.isArray(raw.days) ? raw.days : {};
    for (const key of Object.keys(days)) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(key) || !Array.isArray(days[key])) continue;
      const segs = [];
      for (const x of days[key]) {
        if (!x || typeof x !== 'object') continue;
        const s = Math.floor(Number(x.s)), e = Math.floor(Number(x.e)), b = String(x.b || '');
        if (!Number.isFinite(s) || !Number.isFinite(e) || !b || e <= s) continue;
        segs.push({ s: Math.max(0, s), e: Math.min(DAY_SEC, e), b: b.slice(0, 128) });
      }
      if (segs.length) { segs.sort((a, c) => a.s - c.s || a.e - c.e); out.days[key] = segs; }
    }
    return out;
  }

  /* 从既有覆盖中裁掉 [s,e) 已被记录的部分后追加（先写先得）：
     双 App 短暂双跑、崩溃后补写等场景靠它保证同一段时间不会被记两遍。
     cur 与 segs 均按开始时间有序，双指针跳过不再重叠的旧区间 */
  function appendSegments(days, dateStr, segs) {
    const cur = Array.isArray(days[dateStr]) ? days[dateStr].slice() : [];
    const bid = (v) => String(v || '').slice(0, 128);
    const news = (segs || [])
      .map((x) => ({ s: Math.max(0, Math.floor(x.s)), e: Math.min(DAY_SEC, Math.floor(x.e)), b: bid(x.b) }))
      .filter((x) => x.e > x.s)
      .sort((a, c) => a.s - c.s);
    const pieces = [];
    let startIdx = 0;
    for (const seg of news) {
      let s = seg.s, e = seg.e;
      while (startIdx < cur.length && cur[startIdx].e <= s) startIdx++;
      for (let i = startIdx; i < cur.length; i++) {
        const x = cur[i];
        if (x.s >= e) break;
        if (x.s > s) pieces.push({ s, e: Math.min(e, x.s), b: seg.b });
        s = Math.max(s, Math.min(e, x.e));
        if (s >= e) break;
      }
      if (e > s) pieces.push({ s, e, b: seg.b });
    }
    const out = cur.concat(pieces).sort((a, c) => a.s - c.s || a.e - c.e);
    if (out.length > MAX_SEGMENTS) out.splice(0, out.length - MAX_SEGMENTS);
    days[dateStr] = out;
    return days;
  }

  /* 裁剪历史：只保留 todayStr 往前 MAX_KEEP_DAYS 天 */
  function pruneUsage(usage, todayStr) {
    const floor = addDays(todayStr, -MAX_KEEP_DAYS);
    for (const key of Object.keys(usage.days)) if (key < floor) delete usage.days[key];
    return usage;
  }

  /* 合并同日内首尾相接的同应用区间（采集器按切换切段，切换瞬间可能产生
     s 相同/相邻的碎片）；中间有空隙的不合并——空隙是真实的"未记录时间" */
  function coalesceSegments(days, dateStr) {
    const segs = days[dateStr];
    if (!Array.isArray(segs) || segs.length < 2) return days;
    const out = [];
    for (const seg of segs) {
      const last = out[out.length - 1];
      if (last && last.b === seg.b && last.e >= seg.s) last.e = Math.max(last.e, seg.e);
      else out.push({ s: seg.s, e: seg.e, b: seg.b });
    }
    days[dateStr] = out;
    return days;
  }

  /* ---------- 归属 ---------- */

  /* 区间列表合并重叠（同类别），供 sweep 用 */
  function mergeIntervals(list) {
    const out = [];
    for (const iv of (list || []).slice().sort((a, b) => a[0] - b[0] || a[1] - b[1])) {
      const last = out[out.length - 1];
      if (last && iv[0] <= last[1]) { if (iv[1] > last[1]) last[1] = iv[1]; }
      else out.push([iv[0], iv[1]]);
    }
    return out;
  }

  /* 某天的时段分桶：study = 生效中的学习块；brk = 生效中的短休块；其余时间（会话间大休、
     早于首块、被跳过/收工剔除的块、全天无安排）都归 other（大休·其他）。
     stateLike 需要 schedules/extra/skips/windDown/override/holidays/makeup 字段 */
  function dayBucketsOf(stateLike, dateStr, deps) {
    const d = deps || {};
    const mode = d.modeFor(dateStr, stateLike);
    const sessions = d.mergeExtraSessions(
      ((stateLike || {}).schedules || {})[mode] || [], ((stateLike || {}).extra || {})[dateStr] || [], '加钟');
    const wdList = ((stateLike || {}).windDown || {})[dateStr] || [];
    const lastWd = Array.isArray(wdList) && wdList.length && wdList[wdList.length - 1] && wdList[wdList.length - 1].undoneAt == null
      ? wdList[wdList.length - 1].at : null;
    const dayD = d.expandDay(sessions, ((stateLike || {}).skips || {})[dateStr] || [], lastWd);
    const study = [], brk = [];
    for (const b of dayD.blocks) {
      if (b.off || b.effEnd <= b.start) continue;
      (b.type === 'study' ? study : brk).push([b.start, b.effEnd]);
    }
    return { study: mergeIntervals(study), brk: mergeIntervals(brk) };
  }

  /* 把 [s,e) 沿分桶切类别：返回 [[s, e, cat]]（cat: 'study' | 'brk' | 'other'）。
     学习块与短休块在 expandDay 里天然不重叠，带类别排序后单趟扫描即可 */
  function classifyRange(s, e, buckets) {
    const out = [];
    let pos = s;
    const ivs = buckets.study.map(([a, b]) => [a, b, 'study'])
      .concat(buckets.brk.map(([a, b]) => [a, b, 'brk']))
      .sort((a, b) => a[0] - b[0]);
    for (const [a, b, cat] of ivs) {
      if (b <= pos) continue;
      if (a >= e) break;
      if (a > pos) out.push([pos, Math.min(e, a), 'other']);
      const catEnd = Math.min(e, b);
      out.push([Math.max(pos, a), catEnd, cat]);
      pos = catEnd;
      if (pos >= e) break;
    }
    if (pos < e) out.push([pos, e, 'other']);
    return out;
  }

  /* ---------- 聚合 ---------- */

  /* 汇总 [from, to] 的应用使用：按类别累计总时长 + 每应用三类分钟数（按总时长降序）。
     deps = { modeFor, mergeExtraSessions, expandDay }（复用作息模型，避免环形依赖） */
  function aggregate(usage, stateLike, from, to, deps) {
    const u = normUsage(usage);
    const apps = {};       // bid -> { name, study, brk, other }
    const cats = { study: 0, brk: 0, other: 0 };
    let days = 0;
    const bucketCache = {};
    for (const key of Object.keys(u.days)) {
      if (key < from || key > to) continue;
      const segs = u.days[key];
      if (!segs.length) continue;
      days++;
      const buckets = bucketCache[key] || (bucketCache[key] = dayBucketsOf(stateLike, key, deps));
      for (const seg of segs) {
        const app = apps[seg.b] || (apps[seg.b] = { name: u.apps[seg.b] || seg.b, study: 0, brk: 0, other: 0 });
        for (const [s, e, cat] of classifyRange(seg.s, seg.e, buckets)) {
          const min = (e - s) / 60;
          cats[cat] += min;
          app[cat] += min;
        }
      }
    }
    const round1 = (n) => Math.round(n * 10) / 10;
    const list = Object.keys(apps).map((bid) => {
      const a = apps[bid];
      return { id: bid, name: a.name, study: round1(a.study), brk: round1(a.brk), other: round1(a.other), total: round1(a.study + a.brk + a.other) };
    }).sort((a, b) => b.total - a.total || a.id.localeCompare(b.id));
    return {
      days,
      trackMin: round1(cats.study + cats.brk + cats.other),
      cats: { study: round1(cats.study), brk: round1(cats.brk), other: round1(cats.other) },
      apps: list
    };
  }

  /* ---------- 洞察指标 ---------- */

  /* 学习时段内的应用切换次数：相邻两段 bundle 不同、且切点落在学习块内才计——
     休息/大休时随便切应用不算分心。分母是学习块内"实际有记录"的时长
     （全天排程做分母会让人不在电脑前时显得切换率很低） */
  function switchStatsOf(usage, stateLike, from, to, deps) {
    const u = normUsage(usage);
    let switches = 0, studySec = 0;
    const bucketCache = {};
    for (const key of Object.keys(u.days)) {
      if (key < from || key > to) continue;
      const segs = u.days[key];
      if (!segs.length) continue;
      const buckets = bucketCache[key] || (bucketCache[key] = dayBucketsOf(stateLike, key, deps));
      const study = buckets.study;
      for (const seg of segs) {
        for (const [a, b] of study) {
          const s = Math.max(seg.s, a), e = Math.min(seg.e, b);
          if (e > s) studySec += e - s;
        }
      }
      const inStudy = (sec) => { for (const [a, b] of study) if (a <= sec && sec < b) return true; return false; };
      for (let i = 1; i < segs.length; i++) {
        if (segs[i].b !== segs[i - 1].b && segs[i].s < segs[i - 1].e + 1 && inStudy(segs[i].s)) switches++;
      }
    }
    const studyHours = Math.round((studySec / 3600) * 10) / 10;
    return { switches, studyHours, ratePerHour: studyHours > 0 ? Math.round((switches / studyHours) * 10) / 10 : null };
  }

  /* 学习时段内同一应用连续使用的最长分钟（未记录空隙=人离开=中断）。
     实现：逐天把学习块与区间做有序扫描，应用相同且与上一段无缝（e == s）才延续 */
  function longestSoloOf(usage, stateLike, from, to, deps) {
    const u = normUsage(usage);
    let best = { min: 0, app: null, date: null };
    const bucketCache = {};
    for (const key of Object.keys(u.days)) {
      if (key < from || key > to) continue;
      const segs = u.days[key];
      if (!segs.length) continue;
      const buckets = bucketCache[key] || (bucketCache[key] = dayBucketsOf(stateLike, key, deps));
      const study = buckets.study;
      // 每段与学习块求交得到带应用的学习子区间（有序：segs 与 study 均按起点有序）
      const pieces = [];
      for (const seg of segs) {
        for (const [a, b] of study) {
          const s = Math.max(seg.s, a), e = Math.min(seg.e, b);
          if (e > s) pieces.push({ s, e, b: seg.b });
        }
      }
      pieces.sort((x, y) => x.s - y.s || x.e - y.e);
      let run = null;
      for (const p of pieces) {
        if (run && run.b === p.b && p.s <= run.e && p.s === run.e) run.e = Math.max(run.e, p.e);
        else { if (run) best = pickLonger(best, run, key); run = { s: p.s, e: p.e, b: p.b }; }
      }
      if (run) best = pickLonger(best, run, key);
    }
    return { min: Math.round((best.min) * 10) / 10, app: best.app, date: best.date };
  }
  function pickLonger(best, run, date) {
    const min = (run.e - run.s) / 60;
    return min > best.min ? { min, app: run.b, date } : best;
  }

  /* 应用泳道/图例的确定性配色：bundleId 做 FNV-1a 哈希映射到 10 个色档（au-c0..au-c9），
     同一应用永远同色，与渲染端 CSS 类名对应 */
  function colorClassOf(bundleId) {
    const bid = String(bundleId || '');
    let h = 2166136261 >>> 0;
    for (let i = 0; i < bid.length; i++) {
      h ^= bid.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return 'au-c' + (h % 10);
  }

  return { appUsage: { DAY_SEC, MAX_KEEP_DAYS, MAX_SEGMENTS, normUsage, appendSegments, coalesceSegments, pruneUsage, mergeIntervals, dayBucketsOf, classifyRange, aggregate, switchStatsOf, longestSoloOf, colorClassOf } };
});
