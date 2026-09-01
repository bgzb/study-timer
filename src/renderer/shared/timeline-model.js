(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.StudyTimerShared = Object.assign(root.StudyTimerShared || {}, api);
})(typeof window !== 'undefined' ? window : globalThis, function () {
  function finiteOr(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function clampPosition(value) {
    return Math.max(0, Math.min(100, value));
  }

  function buildTimelineMarkers(sessions, t0, t1) {
    const start = finiteOr(t0, 0);
    const end = finiteOr(t1, start);
    const span = Math.max(1, end - start);
    const markers = (sessions || []).map((session, sessionIndex) => ({
      type: 'start',
      sessionIndex,
      position: clampPosition(((finiteOr(session && session.start, start) - start) / span) * 100),
      isExtra: !!(session && session.isExtra)
    }));
    markers.push({ type: 'end', position: 100 });
    return markers;
  }

  function timelineTooltipPosition(anchor, tooltip, viewport) {
    const margin = 8;
    const width = finiteOr(tooltip && tooltip.width, 0);
    const height = finiteOr(tooltip && tooltip.height, 0);
    const viewportWidth = finiteOr(viewport && viewport.width, width + margin * 2);
    const viewportHeight = finiteOr(viewport && viewport.height, height + margin * 2);
    const center = (finiteOr(anchor && anchor.left, 0) + finiteOr(anchor && anchor.right, 0)) / 2;
    const maxLeft = Math.max(margin, viewportWidth - width - margin);
    const left = Math.max(margin, Math.min(maxLeft, center - width / 2));
    const above = finiteOr(anchor && anchor.top, 0) - height - margin;
    const below = finiteOr(anchor && anchor.bottom, 0) + margin;
    const maxTop = Math.max(margin, viewportHeight - height - margin);
    const top = above >= margin ? above : Math.min(maxTop, below);
    return { left, top };
  }

  return { buildTimelineMarkers, timelineTooltipPosition };
});
