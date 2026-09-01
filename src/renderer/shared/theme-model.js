(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.StudyTimerShared = Object.assign(root.StudyTimerShared || {}, api);
})(typeof window !== 'undefined' ? window : globalThis, function () {
  function normalizePanelTheme(value) {
    return value === 'glass' ? 'glass' : 'paper';
  }

  function nextPanelTheme(value) {
    return normalizePanelTheme(value) === 'glass' ? 'paper' : 'glass';
  }

  return { normalizePanelTheme, nextPanelTheme };
});
