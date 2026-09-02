/* ==================== 状态持久化 ==================== */

function defaultState() {
  return {
    language: 'zh',
    schedules: JSON.parse(JSON.stringify(DEFAULT_SCHEDULES)),
    holidays: Object.assign({}, BUILTIN_HOLIDAYS),
    makeup: Object.assign({}, BUILTIN_MAKEUP),
    holidayTableVersion: HOLIDAY_TABLE_VERSION,
    holidaySync: {},        // 节假日网络同步记录：'年' -> { at, day, keys[] }（18-holiday-sync.js 维护）
    quotes: {
      zh: JSON.parse(JSON.stringify(DEFAULT_QUOTES)),
      en: JSON.parse(JSON.stringify(DEFAULT_QUOTES_EN))
    },
    notifications: true,
    sound: 'chime',
    volume: 0.7,
    override: {},
    skips: {},
    extra: {},
    dailyStats: {},
    blocks: {},            // 每日时间块编辑：'YYYY-MM-DD' -> { '<会话i>-<块j>': { act, note, focus } }
    journal: {},          // 每日总结：'YYYY-MM-DD' -> { headline, mood(0-4|-1), rating(0-5), tags[], good, improve, plan, savedAt, editedAt? }
    summaryDismissed: {}, // 点过"稍后再说"的日期：'YYYY-MM-DD' -> true（当天不再自动弹出）
    enableAck: false
  };
}

function ensureQuotePools(quotes) {
  const defaultsByLang = { zh: DEFAULT_QUOTES, en: DEFAULT_QUOTES_EN };
  if (!quotes || typeof quotes !== 'object' || Array.isArray(quotes)) quotes = {};
  if (!quotes.zh && Object.keys(DEFAULT_QUOTES).some((id) => Array.isArray(quotes[id]))) {
    quotes = { zh: quotes, en: JSON.parse(JSON.stringify(DEFAULT_QUOTES_EN)) };
  }
  Object.keys(defaultsByLang).forEach((lang) => {
    if (!quotes[lang] || typeof quotes[lang] !== 'object' || Array.isArray(quotes[lang])) {
      quotes[lang] = JSON.parse(JSON.stringify(defaultsByLang[lang]));
      return;
    }
    ['extraStart', 'extraEnd'].forEach((id) => {
      if (!Array.isArray(quotes[lang][id])) quotes[lang][id] = JSON.parse(JSON.stringify(defaultsByLang[lang][id]));
    });
  });
  return quotes;
}

function loadState() {
  const s = defaultState();
  let saved = null;
  const all = readAll();
  if (all) {
    // Electron：从共享文件读（旧 localStorage 数据由启动时的迁移一次性搬入）
    saved = all.state || null;
  } else {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) saved = JSON.parse(raw);
    } catch (e) {}
  }
  try {
    if (saved) {
      // 迁移旧版激励语结构，并只为缺失的新类别补入默认值
      Object.assign(s, saved);
      s.quotes = ensureQuotePools(s.quotes);
      if ((saved.holidayTableVersion || 0) < HOLIDAY_TABLE_VERSION) {
        for (const k in BUILTIN_HOLIDAYS) if (!(k in s.holidays)) s.holidays[k] = BUILTIN_HOLIDAYS[k];
        for (const k in BUILTIN_MAKEUP) if (!(k in s.makeup)) s.makeup[k] = BUILTIN_MAKEUP[k];
        s.holidayTableVersion = HOLIDAY_TABLE_VERSION;
      }
    }
  } catch (e) { console.warn('读取设置失败，使用默认值', e); }
  return s;
}

let state = loadState();

function saveState() {
  if (bridge && bridge.saveAll) {
    // 写共享 JSON 文件：主进程落盘并向本 App 各窗口 + 另一个 App 广播同步
    bridge.saveAll({ state, barTheme });
  } else {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(state));
      localStorage.setItem(BAR_THEME_KEY, barTheme);
    } catch (e) { console.warn('保存设置失败', e); }
  }
}
