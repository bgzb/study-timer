(function (root) {
  const api = root.StudyTimerShared || (root.StudyTimerShared = {});
  api.$ = (selector, scope) => (scope || document).querySelector(selector);
  api.escHtml = (value) => String(value == null ? '' : value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
})(typeof window !== 'undefined' ? window : globalThis);
