/* ==================== 设置弹窗 ==================== */

const settingsOverlay = $('#settingsOverlay');
// 打开入口在侧边抽屉（17-tool-drawer.js 的 DRAWER_ACTIONS.settings）
$('#closeSettings').addEventListener('click', () => { closeSettingsPanel(); });
settingsOverlay.addEventListener('click', (e) => {
  if (e.target === settingsOverlay) closeSettingsPanel();
});

function openSettings() {
  settingsOverlay.classList.add('open');
  renderScheduleTab();
  renderHolidayTab();
  renderNotifyTab();
  renderQuotesTab();
  renderDataTab();
  scheduleBarResize(); // bar 面板：确保窗口为固定尺寸（弹层内部自身滚动）
}
function renderScheduleTab() {
  // 每次打开设置时，作息编辑器默认停留在"今天实际运行的模式"上，改了立即生效
  editingMode = modeInfo.mode;
  document.querySelectorAll('#schedModeSeg button').forEach((b) => b.classList.toggle('active', b.dataset.mode === editingMode));
  const names = { workday: t('workday'), weekend: t('weekend'), holiday: t('holiday') };
  const weekday = (state.language === 'en' ? WEEK_EN : WEEK_ZH)[today.dow];
  $('#schedTodayHint').textContent = t('todayHint')(weekday, names[modeInfo.mode],
    modeInfo.note ? ' · ' + modeInfo.note : '');
  renderSessionRows();
  renderSchedPreview();
}

$('#settingsTabs').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-tab]');
  if (!btn) return;
  document.querySelectorAll('#settingsTabs button').forEach((b) => b.classList.toggle('active', b === btn));
  document.querySelectorAll('.tab-section').forEach((s) => s.classList.toggle('active', s.id === 'tab-' + btn.dataset.tab));
});

/* ---- 作息编辑 ---- */
let editingMode = 'workday';

$('#schedModeSeg').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-mode]');
  if (!btn) return;
  editingMode = btn.dataset.mode;
  document.querySelectorAll('#schedModeSeg button').forEach((b) => b.classList.toggle('active', b === btn));
  renderSessionRows();
  renderSchedPreview();
});

function renderSessionRows() {
  const list = $('#sessionList');
  list.innerHTML = '';
  const sessions = state.schedules[editingMode] || [];
  sessions.forEach((s, i) => {
    const row = document.createElement('div');
    row.className = 'session-row';
    row.innerHTML =
      '<input class="s-name" value="' + esc(s.name) + '" placeholder="' + t('ph_name') + '">' +
      '<input class="s-time" value="' + esc(s.start) + '" placeholder="09:00">' +
      '<input class="s-seq" value="' + s.seq.join(' ') + '" placeholder="40 10 40">' +
      '<button class="s-del" title="' + t('delSession') + '" aria-label="' + t('delSession') + '">' + iconSvg('delete', { size: 16 }) + '</button>';
    row.querySelector('.s-del').addEventListener('click', () => {
      sessions.splice(i, 1);
      saveState();
      renderSessionRows();
      renderSchedPreview();
      rebuildDay();
      tick();
    });
    row.querySelectorAll('input').forEach((inp) => {
      inp.addEventListener('change', () => commitSchedule(readSessionRows()));
    });
    list.appendChild(row);
  });
}

function readSessionRows() {
  const rows = document.querySelectorAll('#sessionList .session-row');
  const out = [];
  rows.forEach((row) => {
    out.push({
      name: row.querySelector('.s-name').value.trim() || '时段',
      start: row.querySelector('.s-time').value.trim(),
      seq: row.querySelector('.s-seq').value.trim()
    });
  });
  return out;
}

function commitSchedule(raw) {
  const err = $('#schedError');
  const sessions = [];
  let ok = true;
  const rows = document.querySelectorAll('#sessionList .session-row');
  raw.forEach((s, i) => {
    const row = rows[i];
    const nameOk = s.name.length > 0 && s.name.length <= 8;
    const timeOk = /^([01]?\d|2[0-3]):[0-5]\d$/.test(s.start);
    const seqParts = s.seq.split(/[\s,，、]+/).filter(Boolean);
    const seqOk = seqParts.length >= 1 && seqParts.length <= 16 && seqParts.every((p) => /^\d+$/.test(p) && +p > 0 && +p <= 600);
    row.querySelector('.s-name').classList.toggle('invalid', !nameOk);
    row.querySelector('.s-time').classList.toggle('invalid', !timeOk);
    row.querySelector('.s-seq').classList.toggle('invalid', !seqOk);
    if (nameOk && timeOk && seqOk) sessions.push({ name: s.name, start: s.start, seq: seqParts.map(Number) });
    else ok = false;
  });
  if (!ok) {
    err.textContent = t('schedError');
    renderSchedPreviewFromRaw(raw);
    return;
  }
  err.textContent = '';
  state.schedules[editingMode] = sessions;
  saveState();
  renderSchedPreview();
  rebuildDay();
  tick();
}

function previewHtml(sessions) {
  if (!sessions.length) return '<div class="pv-end">' + t('noSessions') + '</div>';
  const lines = [];
  sessions.forEach((s) => {
    const parts = s.start.split(':').map(Number);
    let cursor = ((parts[0] || 0) * 60 + (parts[1] || 0)) * 60;
    s.seq.forEach((mins, j) => {
      const start = cursor, end = cursor + mins * 60;
      const isStudy = j % 2 === 0;
      lines.push('<span class="pv-' + (isStudy ? 'study' : 'break') + '">' +
        fmtClock(start) + '–' + fmtClock(end) + ' <b>' + (isStudy ? t('studyWord') : t('breakWord')) + '</b> ' + mins + t('min') + '</span>');
      cursor = end;
    });
    lines.push('<span class="pv-end">' + t('sessionEnds')(s.name, fmtClock(cursor)) + '</span>');
  });
  return lines.join('<br>');
}

function renderSchedPreview() {
  $('#schedPreview').innerHTML = previewHtml(state.schedules[editingMode] || []);
}
function renderSchedPreviewFromRaw(raw) {
  const parsed = raw
    .filter((s) => /^([01]?\d|2[0-3]):[0-5]\d$/.test(s.start))
    .map((s) => ({ name: s.name, start: s.start, seq: s.seq.split(/[\s,，、]+/).filter((p) => /^\d+$/.test(p) && +p > 0).map(Number) }))
    .filter((s) => s.seq.length);
  $('#schedPreview').innerHTML = previewHtml(parsed);
}

$('#addSessionBtn').addEventListener('click', () => {
  const sessions = state.schedules[editingMode] || [];
  sessions.push({ name: '时段' + (sessions.length + 1), start: '12:00', seq: [40, 10, 40] });
  state.schedules[editingMode] = sessions;
  saveState();
  renderSessionRows();
  renderSchedPreview();
  rebuildDay();
});

function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;'); }

/* ---- 节假日 ---- */
function renderHolidayTab() {
  const holList = $('#holidayList');
  const mkList = $('#makeupList');
  holList.innerHTML = '';
  mkList.innerHTML = '';
  const holKeys = Object.keys(state.holidays).sort();
  const mkKeys = Object.keys(state.makeup).sort();
  $('#holCount').textContent = t('holCount')(holKeys.length);
  $('#mkCount').textContent = t('mkCount')(mkKeys.length);
  if (!holKeys.length) holList.innerHTML = '<div class="desc" style="font-size:12px;color:var(--text2)">' + t('empty') + '</div>';
  if (!mkKeys.length) mkList.innerHTML = '<div class="desc" style="font-size:12px;color:var(--text2)">' + t('empty') + '</div>';
  holKeys.forEach((k) => holList.appendChild(holidayItem(k, state.holidays[k], 'holidays')));
  mkKeys.forEach((k) => mkList.appendChild(holidayItem(k, state.makeup[k] + ' · ' + t('makeupSuffix'), 'makeup')));
  renderHolidaySyncStatus(holidaySyncing ? 'loading' : (holidaySyncOutcome || 'ok'));
}

function holidayItem(date, name, storeKey) {
  const div = document.createElement('div');
  div.className = 'list-item';
  div.innerHTML = '<span class="li-date">' + date + '</span><span class="li-main">' + esc(name) + '</span><button title="删除" aria-label="删除">' + iconSvg('delete', { size: 16 }) + '</button>';
  div.querySelector('button').addEventListener('click', () => {
    delete state[storeKey][date];
    saveState();
    renderHolidayTab();
    rebuildDay();
    tick();
  });
  return div;
}

$('#holAddBtn').addEventListener('click', () => {
  const date = $('#holDate').value;
  const name = $('#holName').value.trim() || '自定义';
  const type = $('#holType').value;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || isNaN(new Date(date + 'T00:00:00').getTime())) {
    alert(t('invalidDate'));
    return;
  }
  if (type === 'holiday') state.holidays[date] = name;
  else state.makeup[date] = name;
  $('#holDate').value = '';
  $('#holName').value = '';
  saveState();
  renderHolidayTab();
  rebuildDay();
  tick();
});

/* ---- 提醒 ---- */
function renderNotifyTab() {
  $('#notifySwitch').checked = state.notifications;
  $('#volRange').value = Math.round(state.volume * 100);
  // 通知权限诊断
  const p = ('Notification' in window) ? Notification.permission : 'unsupported';
  let permText;
  if (bridge) permText = t('perm_electron');
  else if (p === 'granted') permText = t('perm_granted');
  else if (p === 'denied') permText = t('perm_denied');
  else if (p === 'default') permText = t('perm_default');
  else permText = t('perm_unsupported');
  $('#permStatus').textContent = t('notifStatusPrefix') + permText;
  $('#openNotifPrefBtn').style.display = bridge ? '' : 'none';
  const grid = $('#soundGrid');
  grid.innerHTML = '';
  for (const [id, p] of Object.entries(SOUND_PRESETS)) {
    const card = document.createElement('div');
    card.className = 'soundCard' + (state.sound === id ? ' selected' : '');
    card.innerHTML = '<span class="sc-name">' + t('sound_' + id) + '</span><button class="sc-play" title="播放" aria-label="播放">' + iconSvg('play', { size: 14 }) + '</button>';
    card.addEventListener('click', () => {
      state.sound = id;
      saveState();
      renderNotifyTab();
    });
    card.querySelector('.sc-play').addEventListener('click', (e) => {
      e.stopPropagation();
      const old = state.sound;
      state.sound = id;
      playSound();
      state.sound = old;
    });
    grid.appendChild(card);
  }
}

$('#notifySwitch').addEventListener('change', (e) => {
  state.notifications = e.target.checked;
  saveState();
});
$('#volRange').addEventListener('input', (e) => {
  state.volume = e.target.value / 100;
  saveState();
});
$('#volRange').addEventListener('change', () => playSound());
$('#testNotifyBtn').addEventListener('click', () => {
  const bannerWillSound = !!(bridge && state.notifications);
  // App 内：等主进程的真实投递结果再反馈，不再静默（shown=原生横幅；fallback=被拦走了脚本兜底；blocked=全被拦）
  if (bridge && bridge.notifyCheck && state.notifications) {
    const btn = $('#testNotifyBtn');
    btn.disabled = true;
    bridge.notifyCheck(t('appName'), t('testNotifyBody')).then((r) => {
      btn.disabled = false;
      const msg = r === 'shown' ? t('testNotifyOk')
        : r === 'fallback' ? t('testNotifyFallback')
        : t('testNotifyBlocked');
      $('#permStatus').textContent = t('notifStatusPrefix') + msg;
    });
    return;
  }
  notify(t('appName'), t('testNotifyBody'));
  // 横幅会自带系统提示音；无横幅场景本地补一声
  if (!bannerWillSound) playSound();
});
$('#openNotifPrefBtn').addEventListener('click', () => {
  if (bridge && bridge.openNotificationSettings) bridge.openNotificationSettings();
});

/* ---- 激励语 ---- */
let editingQuoteCat = 'study';

function quoteLang() { return state.language === 'en' ? 'en' : 'zh'; }

function renderQuotesTab() {
  const chips = $('#quoteChips');
  chips.innerHTML = '';
  QUOTE_CATEGORIES.forEach((c) => {
    const b = document.createElement('button');
    b.textContent = t('qc_' + c.id);
    b.className = c.id === editingQuoteCat ? 'active' : '';
    b.addEventListener('click', () => {
      editingQuoteCat = c.id;
      renderQuotesTab();
    });
    chips.appendChild(b);
  });
  const list = $('#quoteList');
  list.innerHTML = '';
  const pool = (state.quotes[quoteLang()] || {})[editingQuoteCat] || [];
  pool.forEach((q, i) => {
    const item = document.createElement('div');
    item.className = 'list-item';
    item.innerHTML = '<span class="li-main">' + esc(q) + '</span><button title="删除" aria-label="删除">' + iconSvg('delete', { size: 16 }) + '</button>';
    item.querySelector('button').addEventListener('click', () => {
      pool.splice(i, 1);
      saveState();
      renderQuotesTab();
    });
    list.appendChild(item);
  });
}

$('#quoteAddBtn').addEventListener('click', () => {
  const input = $('#quoteAddInput');
  const text = input.value.trim();
  if (!text) return;
  const pools = state.quotes[quoteLang()];
  if (!pools[editingQuoteCat]) pools[editingQuoteCat] = [];
  pools[editingQuoteCat].push(text);
  input.value = '';
  saveState();
  renderQuotesTab();
});
$('#quoteAddInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') $('#quoteAddBtn').click();
});
$('#quoteResetBtn').addEventListener('click', () => {
  if (!confirm(t('confirmReset')(t('qc_' + editingQuoteCat)))) return;
  const defaults = quoteLang() === 'en' ? DEFAULT_QUOTES_EN : DEFAULT_QUOTES;
  state.quotes[quoteLang()][editingQuoteCat] = JSON.parse(JSON.stringify(defaults[editingQuoteCat]));
  saveState();
  renderQuotesTab();
});

/* ---- 数据 ---- */
function renderDataTab() {
  const sw = $('#autostartSwitch');
  if (bridge) {
    sw.disabled = false;
    bridge.getAutostart().then((v) => { sw.checked = !!v; }).catch(() => {});
  } else {
    sw.disabled = true;
    sw.checked = false;
    $('#autostartHint').textContent = t('autostartWeb');
  }
  document.querySelectorAll('#langSeg button').forEach((b) => b.classList.toggle('active', b.dataset.lang === quoteLang()));
}

$('#langSeg').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-lang]');
  if (!btn || btn.dataset.lang === quoteLang()) return;
  state.language = btn.dataset.lang;
  // 作息仍是出厂默认时，跟随语言把时段名本地化（上午→Morning 等）
  if (schedulesAreDefault()) localizeScheduleNames();
  saveState();
  applyI18n();
  rebuildDay();
  tick();
  setQuote(currentState(day));
  if (settingsOverlay.classList.contains('open')) openSettings();
});

function schedulesAreDefault() {
  for (const mode of ['workday', 'weekend', 'holiday']) {
    const a = state.schedules[mode] || [];
    for (const ref of [DEFAULT_SCHEDULES[mode], EN_DEFAULT_SCHEDULES[mode]]) {
      if (a.length === ref.length && a.every((s, i) =>
        s.name === ref[i].name && s.start === ref[i].start && s.seq.join(' ') === ref[i].seq.join(' '))) {
        return true;
      }
    }
  }
  return false;
}

function localizeScheduleNames() {
  const names = state.language === 'en' ? ['Morning', 'Afternoon', 'Evening'] : ['上午', '下午', '晚上'];
  for (const mode of ['workday', 'weekend', 'holiday']) {
    const s = state.schedules[mode] || [];
    for (let i = 0; i < s.length && i < 3; i++) s[i].name = names[i];
  }
}

$('#autostartSwitch').addEventListener('change', (e) => {
  if (bridge) bridge.setAutostart(e.target.checked);
});

$('#restartBtn').addEventListener('click', () => {
  if (bridge && bridge.restartApp) bridge.restartApp();
  else location.reload();
});

$('#exportBtn').addEventListener('click', () => {
  const data = {
    app: 'study-timer', version: 2, exportedAt: new Date().toISOString(),
    schedules: state.schedules, holidays: state.holidays, makeup: state.makeup,
    quotes: state.quotes, notifications: state.notifications,
    sound: state.sound, volume: state.volume,
    skips: state.skips, override: state.override, dailyStats: state.dailyStats,
    extra: state.extra || {},
    blocks: state.blocks || {},
    journal: state.journal || {}, summaryDismissed: state.summaryDismissed || {}
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  const d = new Date();
  a.download = 'study-timer-settings-' + d.getFullYear() + pad2(d.getMonth() + 1) + pad2(d.getDate()) + '.json';
  a.click();
  URL.revokeObjectURL(a.href);
});

$('#importBtn').addEventListener('click', () => $('#importFile').click());
$('#importFile').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!data.schedules || !data.schedules.workday) throw new Error('格式不正确');
      if (data.schedules) state.schedules = data.schedules;
      if (data.holidays) state.holidays = data.holidays;
      if (data.makeup) state.makeup = data.makeup;
      if (data.quotes) state.quotes = ensureQuotePools(data.quotes);
      if (typeof data.notifications === 'boolean') state.notifications = data.notifications;
      if (data.sound) state.sound = data.sound;
      if (typeof data.volume === 'number') state.volume = data.volume;
      if (data.skips) state.skips = data.skips;
      if (data.override) state.override = data.override;
      if (data.dailyStats) state.dailyStats = data.dailyStats;
      if (data.extra && typeof data.extra === 'object') state.extra = normalizeExtraData(data.extra);
      if (data.blocks) state.blocks = data.blocks;
      if (data.journal) state.journal = data.journal;
      if (data.summaryDismissed) state.summaryDismissed = data.summaryDismissed;
      saveState();
      rebuildDay();
      openSettings();
      alert(t('imported'));
    } catch (err) {
      alert(t('importFailed')(err.message));
    }
  };
  reader.readAsText(file);
  e.target.value = '';
});

$('#wipeBtn').addEventListener('click', () => {
  if (!confirm(t('confirmWipe'))) return;
  try { localStorage.removeItem(STORE_KEY); localStorage.removeItem(BAR_THEME_KEY); } catch (e) {}
  // 就地重置（两种窗口通用；bar 面板不能整页 reload）
  state = defaultState();
  saveState();
  applyI18n();
  rebuildDay();
  tick();
  setQuote(currentState(day));
  if (settingsOverlay.classList.contains('open')) openSettings();
  if (statsOverlay.classList.contains('open')) renderStatsPanel();
});
