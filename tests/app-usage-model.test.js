const test = require('node:test');
const assert = require('node:assert');
const M = require('../src/renderer/shared/app-usage-model.js').appUsage;

/* 作息模型依赖：与 src/renderer/shared/schedule-model.js 同签名，测试里内联一份 */
const clockMinutes = (v) => { const m = /^(\d{1,2}):(\d{2})$/.exec(String(v || '')); return m ? Number(m[1]) * 60 + Number(m[2]) : NaN; };
const deps = {
  modeFor: (dateStr, state) => {
    const [y, m, d] = String(dateStr).split('-').map(Number);
    const dow = new Date(y, m - 1, d).getDay();
    if ((state.override || {})[dateStr]) return state.override[dateStr];
    if ((state.makeup || {})[dateStr]) return 'workday';
    if ((state.holidays || {})[dateStr]) return 'holiday';
    return dow === 0 || dow === 6 ? 'weekend' : 'workday';
  },
  mergeExtraSessions: (sessions, extras) => sessions.concat(
    (extras || []).map((x) => ({ name: '加钟', start: x.start, end: x.end, seq: [clockMinutes(x.end) - clockMinutes(x.start)], isExtra: true }))
  ).sort((a, b) => clockMinutes(a.start) - clockMinutes(b.start)),
  expandDay: (sessions, skips, wdAt) => {
    const blocks = [];
    (sessions || []).forEach((s, i) => {
      const p = String(s.start).split(':').map(Number);
      let t = (p[0] * 60 + p[1]) * 60;
      (s.seq || []).forEach((mins, j) => {
        const start = t, end = start + mins * 60;
        const key = i + '-' + j;
        const sk = (skips || []).find((x) => x.key === key);
        const b = { key, type: j % 2 === 0 ? 'study' : 'break', start, end, effEnd: sk ? Math.max(start, Math.min(end, sk.at)) : end };
        if (Number.isFinite(wdAt) && wdAt > 0 && b.effEnd > wdAt) {
          if (start >= wdAt) b.off = true; else { b.effEnd = wdAt; b.wd = true; }
        }
        blocks.push(b);
        t = end;
      });
    });
    return { blocks, sess: [] };
  }
};

const baseState = (over) => Object.assign({
  schedules: { workday: [{ name: '上午', start: '09:00', seq: [40, 10, 40] }] },
  extra: {}, skips: {}, windDown: {}, override: {}, holidays: {}, makeup: {}
}, over || {});

test('normUsage 洗数据：坏区间丢弃、按天排序、显示名兜底', () => {
  const u = M.normUsage({
    days: {
      '2026-09-12': [{ s: 100, e: 200, b: 'com.a' }, { s: 500, e: 400, b: 'com.a' }, { s: 10, e: 20 }, null, 'x'],
      'bad': [{ s: 1, e: 2, b: 'com.b' }],
      '2026-09-13': 'nope'
    },
    apps: { 'com.a': 'AppA', '': 'x' }
  });
  assert.deepStrictEqual(u.days['2026-09-12'], [{ s: 100, e: 200, b: 'com.a' }]);
  assert.ok(!('bad' in u.days) && !('2026-09-13' in u.days));
  assert.strictEqual(u.apps['com.a'], 'AppA');
  assert.deepStrictEqual(M.normUsage(null).days, {});
});

test('appendSegments 与既有覆盖去重：重叠部分先写先得', () => {
  const days = {};
  M.appendSegments(days, '2026-09-12', [{ s: 100, e: 200, b: 'com.a' }]);
  // 完全重叠 → 不重复记
  M.appendSegments(days, '2026-09-12', [{ s: 150, e: 180, b: 'com.b' }]);
  assert.deepStrictEqual(days['2026-09-12'], [{ s: 100, e: 200, b: 'com.a' }]);
  // 部分重叠 → 只补没被覆盖的两侧
  M.appendSegments(days, '2026-09-12', [{ s: 50, e: 250, b: 'com.c' }]);
  assert.deepStrictEqual(days['2026-09-12'], [
    { s: 50, e: 100, b: 'com.c' }, { s: 100, e: 200, b: 'com.a' }, { s: 200, e: 250, b: 'com.c' }
  ]);
  // 跨天：每段各自落日（主进程负责拆，这里验证按传入的日期落）
  M.appendSegments(days, '2026-09-12', [{ s: 300, e: 320, b: 'com.a' }, { s: 320, e: 340, b: 'com.a' }]);
  assert.strictEqual(days['2026-09-12'].length, 5);
});

test('appendSegments 极端超限时丢最旧保上限', () => {
  const days = {};
  const segs = [];
  for (let i = 0; i < M.MAX_SEGMENTS + 10; i++) segs.push({ s: i * 10, e: i * 10 + 5, b: 'com.a' });
  M.appendSegments(days, '2026-09-12', segs);
  assert.strictEqual(days['2026-09-12'].length, M.MAX_SEGMENTS);
  assert.strictEqual(days['2026-09-12'][0].s, 100); // 最旧的 10 条被裁
});

test('dayBucketsOf：学习块/短休块分桶，跳过与收工截断生效', () => {
  const st = baseState();
  const bk = M.dayBucketsOf(st, '2026-09-09', deps); // 周三 workday，上午 seq [40,10,40] 共 3 块
  assert.deepStrictEqual(bk.study, [[32400, 34800], [35400, 37800]]); // 9:00-9:40、9:50-10:30
  assert.deepStrictEqual(bk.brk, [[34800, 35400]]);
  // 跳过第二个学习块（9:50 起，0-2）于 9:52 → 只剩开头 2 分钟
  const bk2 = M.dayBucketsOf(baseState({ skips: { '2026-09-09': [{ key: '0-2', at: 35520 }] } }), '2026-09-09', deps);
  assert.deepStrictEqual(bk2.study, [[32400, 34800], [35400, 35520]]);
  // 收工生效：未开始的块剔除、进行中的块截断到收工时刻
  const bk3 = M.dayBucketsOf(baseState({ windDown: { '2026-09-09': [{ at: 36000 }] } }), '2026-09-09', deps);
  assert.deepStrictEqual(bk3.study, [[32400, 34800], [35400, 36000]]);
});

test('classifyRange：沿分桶切出 study/brk/other', () => {
  const buckets = { study: [[3600, 7200]], brk: [[7200, 7500]] };
  assert.deepStrictEqual(M.classifyRange(0, 3600, buckets), [[0, 3600, 'other']]);
  assert.deepStrictEqual(M.classifyRange(3600, 7500, buckets), [[3600, 7200, 'study'], [7200, 7500, 'brk']]);
  assert.deepStrictEqual(M.classifyRange(6000, 8000, buckets), [[6000, 7200, 'study'], [7200, 7500, 'brk'], [7500, 8000, 'other']]);
  assert.deepStrictEqual(M.classifyRange(10000, 11000, buckets), [[10000, 11000, 'other']]);
});

test('aggregate：按应用×类别汇总，大休/无安排时间归 other', () => {
  // 2026-09-09 周三：学习 9:00-9:40、9:50-10:30，短休 9:40-9:50
  const usage = {
    apps: { 'com.a': '编辑器', 'com.b': '浏览器' },
    days: {
      '2026-09-09': [
        { s: 32400, e: 34200, b: 'com.a' },   // 9:00-9:30 学习 → a: 30 学习
        { s: 34200, e: 34800, b: 'com.b' },   // 9:30-9:40 学习 → b: 10 学习
        { s: 34800, e: 35400, b: 'com.b' },   // 9:40-9:50 短休 → b: 10 短休
        { s: 36000, e: 37800, b: 'com.a' },   // 10:00-10:30 学习 → a: 30 学习
        { s: 50000, e: 50600, b: 'com.c' }    // 13:53-14:03 大休 → c: 10 other
      ]
    }
  };
  const r = M.aggregate(usage, baseState(), '2026-09-09', '2026-09-09', deps);
  assert.strictEqual(r.days, 1);
  assert.strictEqual(r.cats.study, 70);
  assert.strictEqual(r.cats.brk, 10);
  assert.strictEqual(r.cats.other, 10);
  const byId = Object.fromEntries(r.apps.map((a) => [a.id, a]));
  assert.strictEqual(byId['com.a'].name, '编辑器');
  assert.strictEqual(byId['com.a'].study, 60);
  assert.strictEqual(byId['com.b'].study, 10);
  assert.strictEqual(byId['com.b'].brk, 10);
  assert.strictEqual(byId['com.c'].other, 10);
  assert.strictEqual(byId['com.c'].name, 'com.c'); // 未知应用名兜底 bundleId
  assert.strictEqual(r.apps[0].id, 'com.a');       // 按总时长降序
});

test('aggregate：范围外日期不计、周末按周末作息归属、加钟按 extra 归属', () => {
  const usage = { days: { '2026-09-06': [{ s: 40000, e: 40200, b: 'com.a' }], '2026-09-09': [{ s: 32400, e: 32600, b: 'com.a' }] } };
  let r = M.aggregate(usage, baseState(), '2026-09-09', '2026-09-09', deps);
  assert.strictEqual(r.days, 1);
  assert.strictEqual(Math.round(r.cats.study * 10) / 10, 3.3); // 200 秒全部在学习块内
  // 2026-09-06 周日，上午会话 9:00-10:30 已结束：11:06 落在会话间大休
  r = M.aggregate(usage, baseState(), '2026-09-06', '2026-09-06', deps);
  assert.strictEqual(r.days, 1);
  assert.strictEqual(Math.round(r.cats.other * 10) / 10, 3.3);
  // 加钟：extra 会话 12:00-12:40 全学习
  const st2 = baseState({ extra: { '2026-09-09': [{ id: 'x1', start: '12:00', end: '12:40' }] } });
  const usage2 = { days: { '2026-09-09': [{ s: 43200, e: 43500, b: 'com.a' }] } };
  r = M.aggregate(usage2, st2, '2026-09-09', '2026-09-09', deps);
  assert.strictEqual(r.cats.study, 5);
});

test('coalesceSegments：合并相邻同应用碎片，有间隙不合并、跨应用不合并', () => {
  const days = { '2026-09-12': [
    { s: 100, e: 120, b: 'com.a' },
    { s: 120, e: 180, b: 'com.a' },   // 相邻同应用 → 合并
    { s: 180, e: 200, b: 'com.b' },   // 换应用 → 保留
    { s: 240, e: 260, b: 'com.b' },   // 有 40 秒间隙 → 保留（间隙是未记录时间）
    { s: 260, e: 280, b: 'com.b' }    // 相邻同应用 → 与上条合并
  ] };
  M.coalesceSegments(days, '2026-09-12');
  assert.deepStrictEqual(days['2026-09-12'], [
    { s: 100, e: 180, b: 'com.a' },
    { s: 180, e: 200, b: 'com.b' },
    { s: 240, e: 280, b: 'com.b' }
  ]);
  // 重叠（先写先得裁剪的产物）也归并
  const days2 = { '2026-09-12': [{ s: 10, e: 30, b: 'com.a' }, { s: 20, e: 40, b: 'com.a' }] };
  M.coalesceSegments(days2, '2026-09-12');
  assert.deepStrictEqual(days2['2026-09-12'], [{ s: 10, e: 40, b: 'com.a' }]);
});

test('switchStatsOf：只计学习时段内的跨应用切换，按小时归一', () => {
  // 2026-09-09 周三：学习 9:00-9:40、9:50-10:30，短休 9:40-9:50
  const usage = { days: { '2026-09-09': [
    { s: 32400, e: 34800, b: 'com.a' },  // 9:00-9:40 学习
    { s: 34800, e: 35400, b: 'com.b' },  // 短休切换 → 不计（切点 9:40 在学习块边界外）
    { s: 35400, e: 36000, b: 'com.c' },  // 9:50 学习块开始 → 切点 35400 在学习块内 → 计 1
    { s: 36000, e: 37800, b: 'com.a' }   // 10:00 学习内切换 → 计 1
  ] } };
  const r = M.switchStatsOf(usage, baseState(), '2026-09-09', '2026-09-09', deps);
  assert.strictEqual(r.switches, 2);
  assert.strictEqual(r.studyHours, 1.3); // (2400+600+1800)/3600
  assert.strictEqual(r.ratePerHour, 1.5); // 2/1.333 → 1.5
  // 空数据：rate 为 null 而不是 0/NaN
  const empty = M.switchStatsOf({ days: {} }, baseState(), '2026-09-09', '2026-09-09', deps);
  assert.deepStrictEqual(empty, { switches: 0, studyHours: 0, ratePerHour: null });
  // 学习时段内带空隙的切换不计（人离开了）
  const gapped = { days: { '2026-09-09': [
    { s: 32400, e: 33600, b: 'com.a' }, { s: 34000, e: 34800, b: 'com.b' }
  ] } };
  assert.strictEqual(M.switchStatsOf(gapped, baseState(), '2026-09-09', '2026-09-09', deps).switches, 0);
});

test('longestSoloOf：学习时段内同应用最长连续，空隙与休息中断', () => {
  const usage = { days: { '2026-09-09': [
    { s: 32400, e: 34200, b: 'com.a' },  // 学习内 30 分钟
    { s: 34200, e: 34800, b: 'com.b' },  // 学习内 10 分钟（换应用）
    { s: 34800, e: 35400, b: 'com.b' },  // 短休 → 与上段之间跨界，不延续
    { s: 35400, e: 37200, b: 'com.b' },  // 学习 9:50-10:20，30 分钟 → 与前段有空隙？无：34800-35400 是短休段，35400 无缝接学习
    { s: 50000, e: 50600, b: 'com.c' }   // 大休，不计
  ] } };
  const r = M.longestSoloOf(usage, baseState(), '2026-09-09', '2026-09-09', deps);
  // com.a 30 分钟 vs com.b：34200-34800（10 分，学习）+ 短休 + 35400-37200（30 分，学习）→ 休息中断，最长仍是 com.b 学习内 30 分钟
  assert.strictEqual(r.min, 30);
  assert.strictEqual(r.app, 'com.a'); // 平局取先出现者
  // 跨休息不延续：b 在学习内的两段被短休隔开
  const usage2 = { days: { '2026-09-09': [
    { s: 33600, e: 34800, b: 'com.b' },  // 学习 9:40-9:50（10 分）+ 覆盖短休 34800-35400 + 学习 35400-37800
    { s: 34800, e: 37800, b: 'com.b' }   // 整段 com.b：学习内有效 10+30=40 分且无缝 → 连续 40
  ] } };
  const r2 = M.longestSoloOf(usage2, baseState(), '2026-09-09', '2026-09-09', deps);
  assert.strictEqual(r2.min, 40);
  assert.strictEqual(r2.app, 'com.b');
  const empty = M.longestSoloOf({ days: {} }, baseState(), '2026-09-09', '2026-09-09', deps);
  assert.deepStrictEqual(empty, { min: 0, app: null, date: null });
});

test('colorClassOf：确定性且均匀分布', () => {
  assert.strictEqual(M.colorClassOf('com.google.Chrome'), M.colorClassOf('com.google.Chrome'));
  assert.ok(/^au-c\d$/.test(M.colorClassOf('com.a')));
  const set = new Set(['com.a', 'com.b', 'com.c', 'com.d', 'com.e', 'com.f', 'com.g'].map(M.colorClassOf));
  assert.ok(set.size > 1); // 不同输入不塌缩到同一色档
  assert.strictEqual(M.colorClassOf(''), 'au-c1'); // 空串 = FNV 偏移基数取模
});

test('pruneUsage：只留近 MAX_KEEP_DAYS 天', () => {
  const usage = { days: { '2020-01-01': [{ s: 0, e: 10, b: 'com.a' }], '2026-09-12': [{ s: 0, e: 10, b: 'com.a' }] } };
  M.pruneUsage(usage, '2026-09-12');
  assert.ok(!('2020-01-01' in usage.days));
  assert.ok('2026-09-12' in usage.days);
});
