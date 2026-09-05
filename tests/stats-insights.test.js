const test = require('node:test');
const assert = require('node:assert/strict');
const insights = require('../src/renderer/shared/stats-insights.js');
const schema = require('../src/renderer/shared/state-schema.js');
const I18N = require('../src/renderer/home/content/i18n.js');

/* 2026-08-24 是周一，08-24..08-30 构成一个完整自然周（周一→周日） */
const dailyStats = {
  '2026-08-24': { focusMin: 130, done: 3, total: 4, skipped: 1, blocks: [
    { s: 9 * 3600, e: 9 * 3600 + 2400, min: 40, act: '数学' },
    { s: 10 * 3600, e: 10 * 3600 + 2400, min: 40, act: '数学' },
    { s: 11 * 3600, e: 11 * 3600 + 2400, min: 40, act: '读论文' },
    { s: 14 * 3600, e: 14 * 3600 + 600, min: 10, sk: true, r: '累了' }
  ] },
  '2026-08-25': { focusMin: 250, done: 5, total: 5, skipped: 0, blocks: [
    { s: 6 * 3600 + 1800, e: 6 * 3600 + 4200, min: 40, act: '读论文' },
    { s: 22 * 3600 + 3000, e: 23 * 3600 + 600, min: 15, act: '数学' }
  ] },
  '2026-08-26': { focusMin: 100, done: 2, total: 2, skipped: 0, blocks: [] },
  '2026-08-27': { focusMin: 100, done: 2, total: 2, skipped: 0, blocks: [{ s: 9 * 3600, e: 9 * 3600 + 1800, min: 30, act: '写作', f: false }] },
  '2026-08-28': { focusMin: 100, done: 2, total: 2, skipped: 0, blocks: [] },
  '2026-08-29': { focusMin: 300, done: 6, total: 6, skipped: 0, blocks: [{ s: 9 * 3600, e: 9 * 3600 + 2400, min: 40, act: '数学' }] },
  '2026-08-30': { focusMin: 480, done: 8, total: 8, skipped: 0, blocks: [] }
};
const journal = {
  '2026-08-24': { mood: 4, rating: 5, tags: ['专注'] },
  '2026-08-25': { mood: 2, rating: 3, tags: ['专注', '疲惫'] }
};
const skips = { '2026-08-24': [{ key: '0-3', at: 14 * 3600 + 300, reason: '累了', type: 'study' }] };
const WEEK_TOTAL = 130 + 250 + 100 + 100 + 100 + 300 + 480;

test('periodSeries aggregates week with 7-day window and previous period', () => {
  const s = insights.periodSeries(dailyStats, journal, { kind: 'week', anchor: '2026-08-30' });
  assert.equal(s.list.length, 7);
  assert.equal(s.list[0].key, '2026-08-24');
  assert.equal(s.list[6].key, '2026-08-30');
  assert.equal(s.totalMin, WEEK_TOTAL);
  assert.equal(s.studyDays, 7);
  assert.equal(s.avgPerDay, Math.round(WEEK_TOTAL / 7));
  assert.equal(s.prev.totalMin, 0);
  assert.equal(s.deltaPct, null);
  assert.ok(s.list[0].hasJ);
  assert.equal(s.list[2].hasJ, false);
});

test('periodSeries month computes delta vs previous month and moving average', () => {
  const ds = Object.assign({ '2026-07-15': { focusMin: 500, done: 1, total: 1, skipped: 0, blocks: [] } }, dailyStats);
  const s = insights.periodSeries(ds, {}, { kind: 'month', anchor: '2026-08-15' });
  assert.equal(s.periodDays, 31);
  assert.equal(s.totalMin, WEEK_TOTAL);
  assert.equal(s.prev.totalMin, 500);
  assert.equal(s.deltaPct, Math.round(((WEEK_TOTAL - 500) / 500) * 100));
  assert.equal(s.list[0].key, '2026-08-01');
  assert.equal(s.list[30].future, true);
  // 8-30 的 7 日均线 = 08-24..08-30 的均值
  assert.equal(s.list.find((x) => x.key === '2026-08-30').ma, Math.round(WEEK_TOTAL / 7));
});

test('periodSeries year aggregates 12 months with future flags', () => {
  const s = insights.periodSeries(dailyStats, {}, { kind: 'year', anchor: '2026-08-30' });
  assert.equal(s.list.length, 12);
  assert.equal(s.unit, 'month');
  assert.equal(s.totalMin, WEEK_TOTAL);
  assert.equal(s.studyDays, 7);
  assert.equal(s.list[7].min, WEEK_TOTAL); // 8 月
  assert.equal(s.list[7].future, false);
  assert.equal(s.list[8].future, true);
  assert.equal(s.best.key, '2026-08');
  assert.equal(s.best.m, 8); // "最高月份"渲染月份名用的月号
});

test('hourDistribution splits blocks across hours and by day type', () => {
  const s = insights.hourDistribution(dailyStats, {
    from: '2026-08-24', to: '2026-08-25',
    holidays: { '2026-08-25': '测试节' }
  });
  assert.equal(s.hours[9], 40);
  assert.equal(s.hours[10], 40);
  assert.equal(s.hours[6], 30);
  assert.equal(s.hours[7], 10);
  assert.equal(s.hours[22], 10);
  assert.equal(s.hours[23], 10);
  assert.equal(s.peak.hour, 9);
  // 08-25 命中节假日 → 归入非工作日桶；工作日只有 24 号
  assert.equal(s.workday.reduce((a, b) => a + b, 0), 130);
  assert.equal(s.weekend.reduce((a, b) => a + b, 0), 60);
});

test('activityTop aggregates act text, excludes skipped and non-focus', () => {
  const s = insights.activityTop(dailyStats, { from: '2026-08-24', to: '2026-08-30' });
  const math = s.find((x) => x.name === '数学');
  assert.equal(math.min, 40 + 40 + 15 + 40); // 24 号两块 + 25 号 15 分钟 + 29 号一块
  assert.equal(s.some((x) => x.name === '写作'), false); // f:false 排除
  assert.equal(s[0].name, '数学');
  const limited = insights.activityTop(dailyStats, { from: '2026-08-24', to: '2026-08-30', n: 1 });
  assert.equal(limited.length, 1);
});

test('skipAnalysis groups reasons, hours and rate', () => {
  const s = insights.skipAnalysis(dailyStats, skips, { from: '2026-08-24', to: '2026-08-30' });
  assert.equal(s.totalSkipped, 1);
  assert.equal(s.totalBlocks, 29);
  assert.equal(s.noReasonCount, 0);
  assert.equal(s.reasons[0].reason, '累了');
  assert.equal(s.hours[14], 1);
  assert.equal(s.peakHour, 14);
  assert.ok(Math.abs(s.rate - 1 / 29) < 1e-9);
});

test('skipAnalysis counts skipped blocks without a trimmed reason', () => {
  const ds = {
    '2026-08-24': {
      focusMin: 20, done: 1, total: 3, skipped: 2,
      blocks: [
        { s: 9 * 3600, e: 9 * 3600 + 600, min: 10, sk: true, r: '  临时有事  ' },
        { s: 10 * 3600, e: 10 * 3600 + 600, min: 10, sk: true, r: '   ' }
      ]
    }
  };
  const s = insights.skipAnalysis(ds, {}, { from: '2026-08-24', to: '2026-08-24' });
  assert.equal(s.totalSkipped, 2);
  assert.equal(s.totalBlocks, 3);
  assert.equal(s.noReasonCount, 1);
  assert.deepEqual(s.reasons, [{ reason: '临时有事', count: 1 }]);
});


test('journalCorrelation computes mood, rating, tags and scatter', () => {
  const s = insights.journalCorrelation(journal, dailyStats);
  assert.equal(s.count, 2);
  assert.deepEqual(s.mood, [0, 0, 1, 0, 1]);
  assert.equal(s.ratingAvg, 4);
  assert.equal(s.tags[0].name, '专注');
  assert.equal(s.tags[0].count, 2);
  assert.deepEqual(insights.journalCorrelation(journal, dailyStats).scatter.find((x) => x.rating === 5), { key: '2026-08-24', rating: 5, min: 130 });
});

test('dayTypeCompare honors holidays, makeup and override priority', () => {
  const s = insights.dayTypeCompare(dailyStats, {
    from: '2026-08-24', to: '2026-08-30',
    holidays: { '2026-08-26': '测试节' },
    makeup: { '2026-08-29': '补班' },
    override: { '2026-08-30': 'workday' }
  });
  assert.equal(s.workday.days, 6); // 24,25,27,28 + 补班 29 + 覆盖 30
  assert.equal(s.workday.studyDays, 6); // 全周都有专注
  assert.equal(s.holiday.days, 1);
  assert.equal(s.holiday.studyDays, 1);
  assert.equal(s.weekend.days, 0);
  assert.equal(s.workday.totalMin, WEEK_TOTAL - 100);
});

test('pointsBalance derives from focus minutes plus achievement points minus spends', () => {
  const bal = insights.pointsBalance(dailyStats, { rewards: [], spends: [{ name: '电影', cost: 200 }, { name: 'x', cost: 'bad' }] });
  assert.equal(bal.earned, WEEK_TOTAL);
  assert.equal(bal.spent, 200);
  assert.equal(bal.balance, WEEK_TOTAL - 200);
  const withAch = insights.pointsBalance(dailyStats,
    { rewards: [], spends: [{ name: '电影', cost: 200 }] },
    { unlockedAt: { total_10h: '2026-08-30' }, points: { total_10h: 60, bad: -5, junk: 'x' } });
  assert.equal(withAch.achEarned, 60); // 非法/负数积分忽略
  assert.equal(withAch.earned, WEEK_TOTAL + 60);
  assert.equal(withAch.balance, WEEK_TOTAL + 60 - 200);
  const empty = insights.pointsBalance({}, null);
  assert.deepEqual({ earned: empty.earned, achEarned: empty.achEarned, spent: empty.spent, balance: empty.balance },
    { earned: 0, achEarned: 0, spent: 0, balance: 0 });
});

test('streaksOf computes current and best runs', () => {
  assert.deepEqual(insights.streaksOf(dailyStats, '2026-08-30'), { cur: 7, best: 7 });
  assert.deepEqual(insights.streaksOf(dailyStats, '2026-08-31'), { cur: 7, best: 7 }); // 今天没学不打断
  const split = { '2026-08-01': { focusMin: 10 }, '2026-08-02': { focusMin: 10 }, '2026-08-05': { focusMin: 10 } };
  assert.deepEqual(insights.streaksOf(split, '2026-08-05'), { cur: 1, best: 2 });
});

test('checkAchievements marks thresholds and progress correctly', () => {
  const list = insights.checkAchievements({ dailyStats, journal, extra: { '2026-08-24': [{ id: 'a' }] } });
  const by = (id) => list.find((x) => x.id === id);
  assert.equal(by('total_10h').done, true);      // 1460 ≥ 600
  assert.equal(by('total_50h').done, false);
  assert.equal(by('total_50h').progress, WEEK_TOTAL);
  assert.equal(by('streak_7').done, true);
  assert.equal(by('day_8h').done, true);         // 480 ≥ 480
  assert.equal(by('perfect_day').done, true);    // 08-30 done=total=8
  assert.equal(by('full_week').done, true);      // 08-24..08-30 全勤
  assert.equal(by('early_bird').done, false);    // 只有 1 天早鸟
  assert.equal(by('early_bird').value, 1);
  assert.equal(by('night_owl').done, false);     // 08-25 末块 23:10 → 1 天
  assert.equal(by('night_owl').value, 1);
  assert.equal(by('journal_10').done, false);
  assert.equal(by('extra_10').value, 1);
  // 新增成就：同批数据上的值与阈值判定
  assert.equal(by('days_30').value, 7); // 7 天有专注
  assert.equal(by('days_30').done, false);
  assert.equal(by('rest_day_8').value, 2); // 08-29 周六 + 08-30 周日
  assert.equal(by('rest_day_8').done, false);
  assert.equal(by('perfect_10').value, 1);
  assert.equal(by('day_12h').done, false);      // 最高 480 < 720
  assert.equal(by('streak_365').done, false);   // 最长 7 < 365
  assert.equal(by('journal_streak_14').value, 2); // 08-24、08-25 连续
  assert.equal(by('journal_100').done, false);
  assert.equal(by('extra_50').done, false);
});

test('new achievement metrics: study days, rest-day study, journal streak', () => {
  // 08-26 周三为节假日、08-29 周六为周末、08-31 周一被覆盖为 weekend
  const ds = {
    '2026-08-26': { focusMin: 60, done: 1, total: 1, skipped: 0, blocks: [] },
    '2026-08-29': { focusMin: 60, done: 1, total: 1, skipped: 0, blocks: [] },
    '2026-08-31': { focusMin: 60, done: 1, total: 1, skipped: 0, blocks: [] }
  };
  const opt = { dailyStats: ds, holidays: { '2026-08-26': '测试节' }, override: { '2026-08-31': 'weekend' } };
  const by = (id) => insights.checkAchievements(opt).find((x) => x.id === id);
  assert.equal(by('days_30').value, 3);
  assert.equal(by('rest_day_8').value, 3); // 节假日 + 周末 + override 周末
  // 无节假日/覆盖时只算周末
  const plain = insights.checkAchievements({ dailyStats: ds }).find((x) => x.id === 'rest_day_8');
  assert.equal(plain.value, 1); // 仅 08-29 周六
  // 手记连击：08-24..08-26 三天连续，08-29 断开不并入
  const js = insights.checkAchievements({
    dailyStats: {},
    journal: {
      '2026-08-24': { mood: 2 }, '2026-08-25': {}, '2026-08-26': { mood: 1 },
      '2026-08-29': { mood: 0 }
    }
  }).find((x) => x.id === 'journal_streak_14');
  assert.equal(js.value, 3);
  assert.equal(js.done, false);
});

test('yearHeatmap builds week columns starting Monday with month marks', () => {
  const hm = insights.yearHeatmap(dailyStats, journal, 2026, '2026-08-30');
  assert.equal(hm.cols.length, 53); // 2025-12-29 起共 53 个周一列
  assert.equal(hm.cols[0][0], null); // 2025-12-29 越界
  assert.equal(hm.cols[0][3].key, '2026-01-01');
  assert.equal(hm.activeDays, 7);
  assert.equal(hm.totalMin, WEEK_TOTAL);
  assert.equal(hm.monthMarks[0].m, 1);
  const lastCol = hm.cols[52];
  assert.equal(lastCol[3].key, '2026-12-31');
  assert.equal(lastCol[4], null);
  const cell = hm.cols[Math.floor((new Date(2026, 7, 24).getTime() - new Date(2025, 11, 29).getTime()) / (7 * 86400000))][0];
  assert.equal(cell.key, '2026-08-24');
  assert.equal(cell.lvl, 4); // 130 ≥ 120
  assert.equal(cell.hasJ, true);
});

test('buildReport composes localized lines from metrics', () => {
  const T = (key, ...args) => {
    const v = I18N.zh[key];
    return typeof v === 'function' ? v(...args) : (v != null ? v : key);
  };
  const r = insights.buildReport(
    { dailyStats, journal, skips, goals: { dailyMin: 300 }, holidays: {}, makeup: {}, override: {} },
    { kind: 'week', anchor: '2026-08-30', T, fmtMin: (m) => Math.round(m) + ' 分钟' }
  );
  assert.equal(r.metrics.totalMin, WEEK_TOTAL);
  assert.equal(r.metrics.goalHit, 2); // 29(300) 30(480) ≥ 300
  assert.ok(r.lines[0].includes('共专注 ' + WEEK_TOTAL));
  assert.ok(r.lines.some((x) => x.includes('黄金时段')));
  assert.ok(r.lines.some((x) => x.includes('数学')));
  assert.ok(r.lines.some((x) => x.includes('累了') || x.includes('跳过')));
  const en = insights.buildReport(
    { dailyStats, journal, skips, goals: { dailyMin: 0 } },
    { kind: 'month', anchor: '2026-08-30', T: (key, ...args) => { const v = I18N.en[key]; return typeof v === 'function' ? v(...args) : v; } }
  );
  assert.ok(en.lines.length >= 3);
});

test('checkAchievements carries pts reward through the result', () => {
  const list = insights.checkAchievements({ dailyStats, journal });
  const by = (id) => list.find((x) => x.id === id);
  assert.equal(by('total_10h').pts, 60);
  assert.equal(by('streak_3').pts, 60);
});

test('achievement pts are positive integers and grow non-linearly within each family', () => {
  const byId = {};
  for (const a of insights.ACHIEVEMENTS) {
    assert.ok(Number.isInteger(a.pts) && a.pts >= 50, a.id + ' pts 应为不小于 50 的整数');
    byId[a.id] = a;
  }
  // 同族递增且增量非线性（高阶成就积分显著高于低阶）
  const family = ['total_10h', 'total_50h', 'total_100h', 'total_300h', 'total_1000h'];
  for (let i = 1; i < family.length; i++) {
    assert.ok(byId[family[i]].pts > byId[family[i - 1]].pts * 2, family[i] + ' 积分应超过前一级的 2 倍');
  }
  assert.ok(byId.streak_100.pts >= 50 * 10); // 最难的坚持成就与简单成就拉开量级
  assert.ok(byId.total_1000h.pts >= 50 * 10);
  // 简单成就只给几十分
  assert.ok(byId.total_10h.pts < 100 && byId.journal_10.pts < 100 && byId.streak_3.pts < 100);
  // 新增家族同样满足：同族递增且高阶超过前一级的 2 倍
  const families = [
    ['day_4h', 'day_8h', 'day_12h'],
    ['streak_3', 'streak_7', 'streak_14', 'streak_30', 'streak_100', 'streak_365'],
    ['days_30', 'days_100'],
    ['perfect_day', 'perfect_10'],
    ['journal_10', 'journal_50', 'journal_100'],
    ['extra_10', 'extra_50']
  ];
  for (const fam of families) {
    for (let i = 1; i < fam.length; i++) {
      assert.ok(byId[fam[i]].pts > byId[fam[i - 1]].pts * 2, fam[i] + ' 积分应超过前一级的 2 倍');
    }
  }
});

test('every achievement has zh/en name, description keys and a valid icon', () => {
  const iconPaths = require('../src/renderer/shared/icons.js').PATHS;
  for (const a of insights.ACHIEVEMENTS) {
    for (const lang of ['zh', 'en']) {
      assert.ok(I18N[lang]['ach_' + a.id] != null, lang + ' 缺少成就名称 ach_' + a.id);
      assert.ok(I18N[lang]['ach_' + a.id + '_d'] != null, lang + ' 缺少成就描述 ach_' + a.id + '_d');
    }
    assert.ok(iconPaths[a.icon] != null, a.id + ' 引用的图标不存在: ' + a.icon);
  }
});

test('legacy state without new fields loads intact and gains defaults', () => {
  const legacy = {
    language: 'en',
    dailyStats: { '2026-01-01': { focusMin: 42, done: 1, total: 1, skipped: 0, blocks: [] } },
    journal: { '2026-01-01': { mood: 3, rating: 4, tags: ['专注'] } },
    holidays: { '2026-10-01': '国庆节' }
  };
  const s = schema.ensureState(legacy);
  // 既有字段逐字段完好
  assert.equal(s.language, 'en');
  assert.deepEqual(s.dailyStats, legacy.dailyStats);
  assert.deepEqual(s.journal, legacy.journal);
  assert.equal(s.holidays['2026-10-01'], '国庆节');
  // 新字段补默认
  assert.deepEqual(s.goals, { dailyMin: 120 });
  assert.deepEqual(s.points, { rewards: [], spends: [] });
  assert.deepEqual(s.achievements, { unlockedAt: {}, points: {} });
  // 部分残缺的新字段也能修复
  const partial = schema.ensureState({ goals: {}, points: { rewards: 'bad' }, achievements: { unlockedAt: [], points: 'bad' } });
  assert.equal(partial.goals.dailyMin, 120);
  assert.deepEqual(partial.points.rewards, []);
  assert.deepEqual(partial.achievements.unlockedAt, {});
  assert.deepEqual(partial.achievements.points, {});
});

test('extraTrend counts sessions by month', () => {
  const s = insights.extraTrend({ '2026-08-01': [{ id: 'a' }, { id: 'b' }], '2026-08-15': [{ id: 'c' }], '2026-07-02': [{ id: 'd' }] }, { anchor: '2026-08-30' });
  assert.equal(s.total, 4);
  assert.equal(s.list.length, 12);
  assert.equal(s.list[11].ym, '2026-08');
  assert.equal(s.list[11].count, 3);
  assert.equal(s.list[10].count, 1);
});
