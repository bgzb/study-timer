(function (root) {
  const api = root.StudyTimerShared || (root.StudyTimerShared = {});
  const pad2 = (n) => String(n).padStart(2, '0');
  function formatDate(d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
  function todayStr() { return formatDate(new Date()); }
  function parseDate(value, fallback) {
    const s = String(value || '');
    return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : (fallback || todayStr());
  }
  function dateParts(value) { return parseDate(value).split('-').map(Number); }
  function dateRange(y1, m1, d1, y2, m2, d2, name) {
    const out = {}, d = new Date(y1, m1 - 1, d1), end = new Date(y2, m2 - 1, d2);
    while (d <= end) { out[formatDate(d)] = name; d.setDate(d.getDate() + 1); }
    return out;
  }
  function clockMinutes(value) {
    const m = String(value || '').match(/^(\d{1,2}):(\d{2})$/);
    if (!m) return NaN;
    const h = Number(m[1]), min = Number(m[2]);
    return h <= 23 && min <= 59 ? h * 60 + min : NaN;
  }
  function fmtClock(sec) {
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60);
    return pad2(h) + ':' + pad2(m);
  }
  function nowSeconds() { const d = new Date(); return d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds(); }
  api.pad2 = pad2; api.formatDate = formatDate; api.todayStr = todayStr; api.parseDate = parseDate;
  api.dateParts = dateParts; api.dateRange = dateRange; api.clockMinutes = clockMinutes;
  api.fmtClock = fmtClock; api.nowSeconds = nowSeconds;
})(typeof window !== 'undefined' ? window : globalThis);
