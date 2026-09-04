(function (root, factory) {
  const api = factory(root.StudyTimerShared || {});
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.StudyTimerShared = Object.assign(root.StudyTimerShared || {}, api);
})(typeof window !== 'undefined' ? window : globalThis, function () {
  const DAY_SEC = 86400;
  const EARLY_SEC = 7 * 3600;   // 早鸟：首块 07:00 前开始
  const LATE_SEC = 23 * 3600;   // 夜猫：末块 23:00 后结束

  /* ---------- 日期工具（与 state-schema / 13-stats 的实现保持一致语义） ---------- */
  function pad2(n) { return String(n).padStart(2, '0'); }
  function fmtDate(d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
  function parseDate(str) { const p = String(str).split('-').map(Number); return new Date(p[0], p[1] - 1, p[2]); }
  function addDays(str, delta) { const d = parseDate(str); d.setDate(d.getDate() + delta); return fmtDate(d); }
  function sortedKeys(obj) { return Object.keys(obj || {}).filter(Boolean).sort(); }
  function statOf(dailyStats, key) { const s = (dailyStats || {})[key]; return s && typeof s === 'object' ? s : null; }
  function hasFocus(dailyStats, key) { const s = statOf(dailyStats, key); return !!s && (s.focusMin || 0) > 0; }

  /* 作息模式判定（与 schedule-model.modeFor 同优先级：override > 补班 > 节假日 > 周末） */
  function modeOfDateStr(dateStr, holidays, makeup, override) {
    const dow = parseDate(dateStr).getDay();
    const ov = (override || {})[dateStr];
    if (ov === 'workday' || ov === 'weekend' || ov === 'holiday') return ov;
    if ((makeup || {})[dateStr]) return 'workday';
    if ((holidays || {})[dateStr]) return 'holiday';
    return dow === 0 || dow === 6 ? 'weekend' : 'workday';
  }

  /* ---------- 连续学习 ---------- */
  function streaksOf(dailyStats, todayStr) {
    let cur = 0;
    if (todayStr) {
      let d = todayStr;
      if (!hasFocus(dailyStats, d)) d = addDays(d, -1); // 今天还没学不打断连续
      while (hasFocus(dailyStats, d)) { cur++; d = addDays(d, -1); }
    }
    let best = 0, run = 0, prev = null;
    for (const k of sortedKeys(dailyStats)) {
      if (!hasFocus(dailyStats, k)) continue;
      run = prev && addDays(prev, 1) === k ? run + 1 : 1;
      if (run > best) best = run;
      prev = k;
    }
    return { cur, best };
  }

  /* ---------- 趋势：周 / 月 / 年聚合（含环比上期） ---------- */
  function dayEntry(dailyStats, journal, key) {
    const s = statOf(dailyStats, key);
    return {
      key,
      min: s ? (s.focusMin || 0) : 0,
      done: s ? (s.done || 0) : 0,
      total: s ? (s.total || 0) : 0,
      skipped: s ? (s.skipped || 0) : 0,
      dow: parseDate(key).getDay(),
      hasJ: !!(journal && journal[key])
    };
  }
  function sumRange(dailyStats, journal, from, to) {
    let totalMin = 0, studyDays = 0, best = null;
    for (const k of sortedKeys(dailyStats)) {
      if (k < from || k > to) continue;
      const min = dailyStats[k].focusMin || 0;
      totalMin += min;
      if (min > 0) { studyDays++; if (!best || min > best.min) best = { key: k, min }; }
    }
    return { totalMin, studyDays, best };
  }
  function ma7At(dailyStats, key) {
    let sum = 0;
    for (let i = 0; i < 7; i++) { const s = statOf(dailyStats, addDays(key, -i)); sum += s ? (s.focusMin || 0) : 0; }
    return Math.round(sum / 7);
  }
  function periodSeries(dailyStats, journal, opts) {
    const o = opts || {}, kind = o.kind || 'week', anchor = o.anchor;
    const ds = dailyStats || {};
    if (kind === 'year') {
      const year = Number(anchor.slice(0, 4));
      const anchorDate = parseDate(anchor);
      const list = []; let totalMin = 0, studyDays = 0, best = null;
      for (let m = 1; m <= 12; m++) {
        const prefix = year + '-' + pad2(m);
        let min = 0, days = 0;
        for (const k of sortedKeys(ds)) {
          if (!k.startsWith(prefix)) continue;
          const v = ds[k].focusMin || 0;
          min += v;
          if (v > 0) days++;
        }
        list.push({ key: prefix, m, min, days, future: new Date(year, m - 1, 1) > anchorDate });
        totalMin += min; studyDays += days;
        // best 带 m（月号）：趋势·年视图的"最高月份"用它渲染月份名
        if (min > 0 && (!best || min > best.min)) best = { key: prefix, m, min };
      }
      const prev = sumRange(ds, null, (year - 1) + '-01-01', (year - 1) + '-12-31');
      return {
        kind, unit: 'month', anchor, list, totalMin, studyDays, periodDays: 12,
        avgPerDay: Math.round(totalMin / 365), avgPerStudyDay: studyDays ? Math.round(totalMin / studyDays) : 0,
        best, prev, deltaPct: prev.totalMin > 0 ? Math.round(((totalMin - prev.totalMin) / prev.totalMin) * 100) : null
      };
    }
    if (kind === 'month') {
      const a = parseDate(anchor), y = a.getFullYear(), m = a.getMonth();
      const daysInMonth = new Date(y, m + 1, 0).getDate();
      const from = y + '-' + pad2(m + 1) + '-01', to = y + '-' + pad2(m + 1) + '-' + pad2(daysInMonth);
      const list = [];
      for (let d = 1; d <= daysInMonth; d++) {
        const key = y + '-' + pad2(m + 1) + '-' + pad2(d);
        const e = dayEntry(ds, journal, key);
        e.ma = ma7At(ds, key);
        e.future = key > anchor;
        list.push(e);
      }
      const cur = sumRange(ds, journal, from, to);
      const pf = m === 0 ? (y - 1) + '-01-01' : y + '-' + pad2(m) + '-01';
      const pt = m === 0 ? (y - 1) + '-12-31' : y + '-' + pad2(m) + '-' + pad2(new Date(y, m, 0).getDate());
      const prev = sumRange(ds, null, pf, pt);
      return {
        kind, unit: 'day', anchor, from, to, list,
        totalMin: cur.totalMin, studyDays: cur.studyDays, periodDays: daysInMonth, best: cur.best,
        avgPerDay: Math.round(cur.totalMin / daysInMonth),
        avgPerStudyDay: cur.studyDays ? Math.round(cur.totalMin / cur.studyDays) : 0,
        prev, deltaPct: prev.totalMin > 0 ? Math.round(((cur.totalMin - prev.totalMin) / prev.totalMin) * 100) : null
      };
    }
    // week：以 anchor 结尾的 7 天
    const to = anchor, from = addDays(anchor, -6);
    const list = [];
    for (let i = 0; i < 7; i++) list.push(dayEntry(ds, journal, addDays(from, i)));
    const cur = sumRange(ds, journal, from, to);
    const prev = sumRange(ds, null, addDays(from, -7), addDays(from, -1));
    return {
      kind: 'week', unit: 'day', anchor, from, to, list,
      totalMin: cur.totalMin, studyDays: cur.studyDays, periodDays: 7, best: cur.best,
      avgPerDay: Math.round(cur.totalMin / 7),
      avgPerStudyDay: cur.studyDays ? Math.round(cur.totalMin / cur.studyDays) : 0,
      prev, deltaPct: prev.totalMin > 0 ? Math.round(((cur.totalMin - prev.totalMin) / prev.totalMin) * 100) : null
    };
  }

  /* ---------- 黄金时段：24 小时专注分布（可分工作日 / 非工作日） ---------- */
  function hourDistribution(dailyStats, opts) {
    const o = opts || {};
    const all = new Array(24).fill(0), wd = new Array(24).fill(0), we = new Array(24).fill(0);
    let days = 0, total = 0;
    for (const k of sortedKeys(dailyStats)) {
      if (o.from && k < o.from) continue;
      if (o.to && k > o.to) continue;
      const s = dailyStats[k];
      if (!s || !(s.focusMin > 0)) continue;
      days++;
      const isWork = modeOfDateStr(k, o.holidays, o.makeup, o.override) === 'workday';
      for (const b of s.blocks || []) {
        if (b.f === false) continue;
        let t = Math.max(0, b.s | 0);
        const end = Math.min(DAY_SEC, b.e | 0);
        while (t < end) {
          const h = Math.floor(t / 3600) % 24;
          const segEnd = Math.min(end, (Math.floor(t / 3600) + 1) * 3600);
          const mins = (segEnd - t) / 60;
          all[h] += mins;
          (isWork ? wd : we)[h] += mins;
          total += mins;
          t = segEnd;
        }
      }
    }
    let peak = null;
    if (total > 0) { let h = 0; for (let i = 1; i < 24; i++) if (all[i] > all[h]) h = i; peak = { hour: h, min: Math.round(all[h]) }; }
    return { hours: all.map(Math.round), workday: wd.map(Math.round), weekend: we.map(Math.round), days, totalMin: Math.round(total), peak };
  }

  /* ---------- 活动榜：块上"做的事"自由文本聚合 ---------- */
  function activityTop(dailyStats, opts) {
    const o = opts || {}, n = o.n || 8, map = {};
    for (const k of sortedKeys(dailyStats)) {
      if (o.from && k < o.from) continue;
      if (o.to && k > o.to) continue;
      const s = dailyStats[k];
      if (!s) continue;
      for (const b of s.blocks || []) {
        if (b.f === false || b.sk) continue;
        const name = String(b.act || '').trim();
        if (!name) continue;
        const key = name.toLowerCase();
        const e = map[key] || (map[key] = { name, min: 0, count: 0 });
        e.min += b.min || 0;
        e.count++;
      }
    }
    return Object.keys(map).map((k) => map[k])
      .sort((a, b) => b.min - a.min || b.count - a.count)
      .slice(0, n)
      .map((e) => ({ name: e.name, min: Math.round(e.min * 10) / 10, count: e.count }));
  }

  /* ---------- 跳过分析：理由分组 + 高发时段 + 跳过率 ---------- */
  function skipAnalysis(dailyStats, skips, opts) {
    const o = opts || {};
    const reasons = {}, hours = new Array(24).fill(0);
    let totalSkipped = 0, totalBlocks = 0, noReasonCount = 0;
    for (const k of sortedKeys(dailyStats)) {
      if (o.from && k < o.from) continue;
      if (o.to && k > o.to) continue;
      const s = dailyStats[k];
      if (!s) continue;
      totalSkipped += s.skipped || 0;
      totalBlocks += s.total || 0;
      for (const b of s.blocks || []) {
        if (!b.sk) continue;
        const r = String(b.r == null ? '' : b.r).trim();
        if (!r) { noReasonCount++; continue; }
        const e = reasons[r.toLowerCase()] || (reasons[r.toLowerCase()] = { reason: r, count: 0 });
        e.count++;
      }
    }
    // 高发时段看事件日志（含具体跳过时刻；休息块跳过不算学习中断）
    for (const k of sortedKeys(skips)) {
      if (o.from && k < o.from) continue;
      if (o.to && k > o.to) continue;
      for (const x of skips[k] || []) {
        if (!x || x.type === 'break' || x.at == null) continue;
        hours[Math.floor(x.at / 3600) % 24]++;
      }
    }
    let peakHour = null;
    const hourSum = hours.reduce((a, b) => a + b, 0);
    if (hourSum > 0) { let h = 0; for (let i = 1; i < 24; i++) if (hours[i] > hours[h]) h = i; peakHour = h; }
    return {
      totalSkipped, totalBlocks,
      noReasonCount,
      rate: totalBlocks > 0 ? totalSkipped / totalBlocks : 0,
      reasons: Object.keys(reasons).map((k) => reasons[k]).sort((a, b) => b.count - a.count).slice(0, 8),
      hours, peakHour
    };
  }

  /* ---------- 手记 × 数据联动 ---------- */
  function journalCorrelation(journal, dailyStats) {
    const mood = new Array(5).fill(0);
    const tags = {};
    let moodSum = 0, moodCount = 0, ratingSum = 0, ratingCount = 0, count = 0;
    const scatter = [];
    for (const k of sortedKeys(journal)) {
      const e = journal[k];
      if (!e) continue;
      count++;
      if (e.mood >= 0 && e.mood < 5) { mood[e.mood]++; moodSum += e.mood; moodCount++; }
      if (e.rating > 0) {
        ratingSum += e.rating; ratingCount++;
        const s = statOf(dailyStats, k);
        scatter.push({ key: k, rating: e.rating, min: s ? (s.focusMin || 0) : 0 });
      }
      for (const tg of e.tags || []) { const n = String(tg).trim(); if (n) { tags[n] = (tags[n] || 0) + 1; } }
    }
    return {
      count, mood,
      moodAvg: moodCount ? moodSum / moodCount : null,
      ratingAvg: ratingCount ? ratingSum / ratingCount : null, ratingCount,
      tags: Object.keys(tags).map((n) => ({ name: n, count: tags[n] })).sort((a, b) => b.count - a.count).slice(0, 10),
      scatter
    };
  }

  /* ---------- 工作日 / 周末 / 节假日对比（学习率） ---------- */
  function dayTypeCompare(dailyStats, opts) {
    const o = opts || {};
    const from = o.from, to = o.to;
    const buckets = {
      workday: { days: 0, studyDays: 0, totalMin: 0 },
      weekend: { days: 0, studyDays: 0, totalMin: 0 },
      holiday: { days: 0, studyDays: 0, totalMin: 0 }
    };
    if (!from || !to) return { workday: flat(buckets.workday), weekend: flat(buckets.weekend), holiday: flat(buckets.holiday) };
    for (let k = from; k <= to; k = addDays(k, 1)) {
      const b = buckets[modeOfDateStr(k, o.holidays, o.makeup, o.override)] || buckets.workday;
      b.days++;
      const s = statOf(dailyStats, k);
      if (s && (s.focusMin || 0) > 0) { b.studyDays++; b.totalMin += s.focusMin; }
    }
    const out = {};
    for (const k of Object.keys(buckets)) out[k] = Object.assign({}, buckets[k], {
      avgMin: buckets[k].studyDays ? Math.round(buckets[k].totalMin / buckets[k].studyDays) : 0,
      rate: buckets[k].days ? buckets[k].studyDays / buckets[k].days : 0
    });
    return out;
    function flat(b) { return Object.assign({}, b, { avgMin: 0, rate: 0 }); }
  }

  /* ---------- 加钟月度趋势 ---------- */
  function extraTrend(extra, opts) {
    const o = opts || {};
    const counts = {};
    let total = 0;
    for (const k of sortedKeys(extra)) {
      const list = extra[k];
      if (!Array.isArray(list)) continue;
      const ym = k.slice(0, 7);
      counts[ym] = (counts[ym] || 0) + list.length;
      total += list.length;
    }
    let list;
    if (o.anchor) {
      const a = parseDate(o.anchor.slice(0, 7) + '-01'); // anchor 为某天，取所在月
      list = [];
      for (let i = 11; i >= 0; i--) {
        const d = new Date(a.getFullYear(), a.getMonth() - i, 1);
        list.push({ ym: d.getFullYear() + '-' + pad2(d.getMonth() + 1), count: counts[d.getFullYear() + '-' + pad2(d.getMonth() + 1)] || 0 });
      }
    } else {
      list = Object.keys(counts).sort().map((ym) => ({ ym, count: counts[ym] }));
    }
    return { list, total };
  }

  /* ---------- 积分：余额 = 累计专注分钟 − 已兑换（幂等，无收入流水） ---------- */
  function pointsBalance(dailyStats, points) {
    let earned = 0;
    for (const k of Object.keys(dailyStats || {})) earned += (dailyStats[k].focusMin || 0);
    earned = Math.round(earned);
    const spends = (points && points.spends) || [];
    let spent = 0;
    for (const x of spends) spent += Math.max(0, Number(x && x.cost) || 0);
    return { earned, spent: Math.round(spent), balance: earned - Math.round(spent) };
  }

  /* ---------- 成就注册表：追加条目即扩展新成就（渲染端读取 id/icon/group/goal/progress） ----------
     titleKey/descKey 对应 i18n 键 ach_<id> / ach_<id>_d（desc 接收 goal 文案参数） */
  const ACHIEVEMENTS = [
    { id: 'total_10h', group: 'focus', icon: 'time', goal: 600, value: (c) => c.totalMin },
    { id: 'total_50h', group: 'focus', icon: 'time', goal: 3000, value: (c) => c.totalMin },
    { id: 'total_100h', group: 'focus', icon: 'time', goal: 6000, value: (c) => c.totalMin },
    { id: 'total_300h', group: 'focus', icon: 'star', goal: 18000, value: (c) => c.totalMin },
    { id: 'total_1000h', group: 'focus', icon: 'star', goal: 60000, value: (c) => c.totalMin },
    { id: 'streak_3', group: 'streak', icon: 'done', goal: 3, value: (c) => c.bestStreak },
    { id: 'streak_7', group: 'streak', icon: 'done', goal: 7, value: (c) => c.bestStreak },
    { id: 'streak_14', group: 'streak', icon: 'star', goal: 14, value: (c) => c.bestStreak },
    { id: 'streak_30', group: 'streak', icon: 'star', goal: 30, value: (c) => c.bestStreak },
    { id: 'streak_100', group: 'streak', icon: 'star', goal: 100, value: (c) => c.bestStreak },
    { id: 'day_4h', group: 'focus', icon: 'study', goal: 240, value: (c) => c.bestDayMin },
    { id: 'day_8h', group: 'focus', icon: 'study', goal: 480, value: (c) => c.bestDayMin },
    { id: 'perfect_day', group: 'habit', icon: 'check', goal: 1, value: (c) => c.perfectDays },
    { id: 'full_week', group: 'habit', icon: 'stats', goal: 1, value: (c) => c.fullWeeks },
    { id: 'no_skip_week', group: 'habit', icon: 'skip', goal: 1, value: (c) => c.noSkipWeeks },
    { id: 'early_bird', group: 'habit', icon: 'time', goal: 10, value: (c) => c.earlyDays },
    { id: 'night_owl', group: 'habit', icon: 'break', goal: 10, value: (c) => c.lateDays },
    { id: 'journal_10', group: 'journal', icon: 'journal', goal: 10, value: (c) => c.journalCount },
    { id: 'journal_50', group: 'journal', icon: 'journal', goal: 50, value: (c) => c.journalCount },
    { id: 'extra_10', group: 'extra', icon: 'add', goal: 10, value: (c) => c.extraCount }
  ];

  function achievementCtx(stateLike) {
    const dailyStats = stateLike.dailyStats || {};
    const journal = stateLike.journal || {};
    const extra = stateLike.extra || {};
    const keys = sortedKeys(dailyStats).filter((k) => hasFocus(dailyStats, k));
    let totalMin = 0, bestDayMin = 0, perfectDays = 0, earlyDays = 0, lateDays = 0;
    for (const k of sortedKeys(dailyStats)) {
      const s = dailyStats[k];
      totalMin += s.focusMin || 0;
      if ((s.focusMin || 0) > bestDayMin) bestDayMin = s.focusMin;
      if (s.done === s.total && s.total >= 8 && (s.focusMin || 0) > 0) perfectDays++;
      const blocks = (s.blocks || []).filter((b) => b.f !== false);
      if (blocks.length && (s.focusMin || 0) > 0) {
        if (Math.min.apply(null, blocks.map((b) => b.s | 0)) <= EARLY_SEC) earlyDays++;
        if (Math.max.apply(null, blocks.map((b) => b.e | 0)) >= LATE_SEC) lateDays++;
      }
    }
    // 全勤周 / 零跳过周：以周一为起点扫描出现过的每个自然周
    const mondays = {};
    for (const k of keys) {
      const d = parseDate(k), back = (d.getDay() + 6) % 7; // 周一=0
      mondays[addDays(k, -back)] = true;
    }
    let fullWeeks = 0, noSkipWeeks = 0;
    for (const mon of Object.keys(mondays)) {
      let allFocus = true, blocks = 0, skipped = 0;
      for (let i = 0; i < 7; i++) {
        const s = statOf(dailyStats, addDays(mon, i));
        if (!s || !(s.focusMin > 0)) { allFocus = false; }
        blocks += s ? (s.total || 0) : 0;
        skipped += s ? (s.skipped || 0) : 0;
      }
      if (allFocus) fullWeeks++;
      if (blocks >= 20 && skipped === 0) noSkipWeeks++;
    }
    let extraCount = 0;
    for (const k of Object.keys(extra)) if (Array.isArray(extra[k])) extraCount += extra[k].length;
    const journalCount = sortedKeys(journal).filter((k) => journal[k]).length;
    return {
      totalMin, bestDayMin, perfectDays, earlyDays, lateDays, fullWeeks, noSkipWeeks,
      extraCount, journalCount,
      bestStreak: streaksOf(dailyStats, null).best
    };
  }
  function checkAchievements(stateLike) {
    const ctx = achievementCtx(stateLike);
    return ACHIEVEMENTS.map((a) => {
      const value = Math.max(0, Math.round(a.value(ctx)));
      return { id: a.id, group: a.group, icon: a.icon, goal: a.goal, value, progress: Math.min(value, a.goal), done: value >= a.goal };
    });
  }

  /* ---------- 周 / 月自动报告 ---------- */
  function buildReport(stateLike, opts) {
    const o = opts || {};
    const kind = o.kind === 'month' ? 'month' : 'week';
    const anchor = o.anchor;
    const T = o.T || ((key, ...args) => key);
    const F = o.fmtMin || ((m) => Math.round(m) + ' min');
    const dailyStats = stateLike.dailyStats || {};
    const series = periodSeries(dailyStats, stateLike.journal, { kind, anchor });
    const from = kind === 'month' ? series.from : addDays(anchor, -6);
    const to = kind === 'month' ? series.to : anchor;
    const hours = hourDistribution(dailyStats, { from, to, holidays: stateLike.holidays, makeup: stateLike.makeup, override: stateLike.override });
    const acts = activityTop(dailyStats, { from, to, n: 3 });
    const skip = skipAnalysis(dailyStats, stateLike.skips, { from, to });
    const goalMin = (stateLike.goals && stateLike.goals.dailyMin) || 0;
    let goalHit = 0;
    for (const e of series.list) if (goalMin > 0 && e.min >= goalMin) goalHit++;
    // 报告期内的手记
    const jKeys = sortedKeys(stateLike.journal).filter((k) => stateLike.journal[k] && k >= from && k <= to);
    let ratingSum = 0, ratingN = 0;
    for (const k of jKeys) { const r = stateLike.journal[k].rating; if (r > 0) { ratingSum += r; ratingN++; } }
    const metrics = {
      kind, from, to,
      totalMin: series.totalMin, studyDays: series.studyDays, periodDays: series.periodDays,
      avgPerDay: series.avgPerDay, best: series.best, deltaPct: series.deltaPct,
      peak: hours.peak, topActivities: acts,
      skipRate: skip.rate, totalSkipped: skip.totalSkipped,
      goalMin, goalHit, journalCount: jKeys.length,
      ratingAvg: ratingN ? Math.round((ratingSum / ratingN) * 10) / 10 : null
    };
    const lines = [T('rp_head', F(metrics.totalMin), metrics.studyDays, metrics.periodDays)];
    if (series.deltaPct !== null) lines.push(T('rp_delta', series.deltaPct));
    if (metrics.best) lines.push(T('rp_best', F(metrics.best.min), metrics.best.key.slice(5)));
    if (hours.peak) lines.push(T('rp_peak', hours.peak.hour));
    if (acts.length) lines.push(T('rp_acts', acts.map((a) => a.name + ' ' + F(a.min)).join(' · ')));
    if (metrics.totalSkipped > 0) lines.push(T('rp_skip', metrics.totalSkipped, Math.round(skip.rate * 100)));
    if (goalMin > 0) lines.push(T('rp_goal', goalHit, metrics.periodDays, goalMin));
    if (jKeys.length) {
      lines.push(ratingN ? T('rp_journal', jKeys.length, metrics.ratingAvg) : T('rp_journal_n', jKeys.length));
    }
    return { metrics, lines };
  }

  /* ---------- 全年热力图（GitHub 式：列为周、行为周一→周日） ---------- */
  function heatLevel(min) { return min <= 0 ? 0 : min < 30 ? 1 : min < 60 ? 2 : min < 120 ? 3 : 4; }
  function yearHeatmap(dailyStats, journal, year, todayStr) {
    let start = year + '-01-01';
    while (parseDate(start).getDay() !== 1) start = addDays(start, -1);
    const end = year + '-12-31';
    const cols = [];
    let totalMin = 0, activeDays = 0, cursor = start;
    while (cursor <= end) {
      const col = [];
      for (let r = 0; r < 7; r++) {
        const key = addDays(cursor, r);
        if (key > end || key < year + '-01-01') { col.push(null); continue; }
        const s = statOf(dailyStats, key);
        const min = s ? (s.focusMin || 0) : 0;
        if (min > 0) { totalMin += min; activeDays++; }
        col.push({ key, min, lvl: heatLevel(min), hasJ: !!(journal && journal[key]), future: todayStr ? key > todayStr : false, today: key === todayStr });
      }
      cols.push(col);
      cursor = addDays(cursor, 7);
    }
    // 月份标尺：每月第一天落在的列
    const monthMarks = [];
    for (let m = 1; m <= 12; m++) {
      const first = year + '-' + pad2(m) + '-01';
      const colIndex = Math.floor((parseDate(first).getTime() - parseDate(start).getTime()) / (7 * DAY_SEC * 1000));
      if (colIndex >= 0 && colIndex < cols.length) monthMarks.push({ m, col: colIndex });
    }
    return { year, cols, monthMarks, totalMin, activeDays, bestStreak: streaksOf(dailyStats, null).best };
  }

  return {
    pad2, fmtDate, parseDate, addDays, sortedKeys, statOf, modeOfDateStr,
    streaksOf, periodSeries, hourDistribution, activityTop, skipAnalysis,
    journalCorrelation, dayTypeCompare, extraTrend, pointsBalance,
    ACHIEVEMENTS, checkAchievements, achievementCtx, buildReport, yearHeatmap, heatLevel
  };
});
