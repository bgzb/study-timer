'use strict';

/*
 * Study Timer 的小型图标字典。
 * 只保存几何路径，不依赖外部字体或图标 CDN；颜色统一交给 currentColor，
 * 因而同一套图标可用于纸面主题、毛玻璃主题和 macOS 深色模式。
 */
(function initIcons(root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.StudyTimerIcons = api;
})(typeof window !== 'undefined' ? window : globalThis, function createIconApi() {
  const PATHS = {
    unknown: '<path d="M16 5a11 11 0 1 0 0 22 11 11 0 0 0 0-22Zm0 15v.1M13.5 12.5a2.7 2.7 0 1 1 4.7 1.8c-1.2 1.1-2.2 1.5-2.2 3"/>',
    more: '<path d="M6 9h20M6 16h20M6 23h13"/>',
    settings: '<circle cx="16" cy="16" r="7"/><path d="M16 3v4M16 25v4M3 16h4M25 16h4M6.8 6.8l2.8 2.8M22.4 22.4l2.8 2.8M25.2 6.8l-2.8 2.8M9.6 22.4l-2.8 2.8"/>',
    journal: '<path d="M7 5h13l5 5v17H7Z"/><path d="M20 5v6h5M11 16h9M11 21h6"/>',
    stats: '<path d="M6 27V5M6 27h21"/><path d="M11 22v-7M17 22V9M23 22v-4"/>',
    study: '<path d="M5 24V8.5C5 6.6 6.6 5 8.5 5H15v21H8.5C6.6 26 5 25.4 5 24ZM27 24V8.5C27 6.6 25.4 5 23.5 5H17v21h6.5c1.9 0 3.5-.6 3.5-2Z"/><path d="M16 6v20"/>',
    break: '<path d="M7 12h15v8a6 6 0 0 1-6 6h-3a6 6 0 0 1-6-6Z"/><path d="M22 15h2a4 4 0 0 1 0 8h-2M11 8c0-2 2-2 2-4M17 8c0-2 2-2 2-4"/>',
    done: '<circle cx="16" cy="16" r="11"/><path d="m10.5 16 3.5 3.5 7.5-8"/>',
    skip: '<path d="M4 9h8M4 23h8M16 9l10 7-10 7V9ZM12 9v14"/>',
    quote: '<path d="M7 8h18v13H11l-4 4Z"/><path d="M12 13h8M12 17h5"/>',
    notify: '<path d="M8 23h16l-2-3v-6a6 6 0 0 0-12 0v6Z"/><path d="M13 27h6M25 7l2 2"/>',
    edit: '<path d="m7 24-1 4 4-1L24 13l-3-3Z"/><path d="m19 8 5 5"/>',
    time: '<circle cx="16" cy="16" r="11" stroke-dasharray="20 8"/><path d="M16 9v8l5 3"/>',
    close: '<path d="m10 10 12 12M22 10 10 22"/>',
    delete: '<path d="M6 9h20M13 5h6l1 4H12ZM9 9l1 18h12l1-18M13 13v9M19 13v9"/>',
    check: '<path d="m7 16 6 6L26 9"/>',
    add: '<path d="M16 6v20M6 16h20"/>',
    export: '<path d="M16 4v16M10 10l6-6 6 6M7 20v6h18v-6"/>',
    import: '<path d="M16 20V4M10 14l6 6 6-6M7 20v6h18v-6"/>',
    reset: '<path d="M7 13a10 10 0 1 1 3 10"/><path d="M7 6v7h7"/>',
    play: '<path d="m11 7 13 9-13 9Z"/>',
    back: '<path d="M20 7 11 16l9 9M12 16h14"/>',
    tag: '<path d="M5 7v8l12 12 10-10L15 5H7a2 2 0 0 0-2 2Z"/><circle cx="11" cy="11" r="1.5"/>',
    mood0: '<path d="M8 13h3M21 13h3M9 23c2-3 12-3 14 0"/><path d="M16 5c-6 0-10 4-10 10 0 6 4 10 10 10s10-4 10-10S22 5 16 5Z"/>',
    mood1: '<path d="M9 13h3M20 13h3M10 22c3-2 9-2 12 0"/><path d="M16 5c-6 0-10 4-10 10 0 6 4 10 10 10s10-4 10-10S22 5 16 5Z"/>',
    mood2: '<path d="M9 13h3M20 13h3M11 21h10"/><path d="M16 5c-6 0-10 4-10 10 0 6 4 10 10 10s10-4 10-10S22 5 16 5Z"/>',
    mood3: '<path d="M9 13h3M20 13h3M10 19c3 3 9 3 12 0"/><path d="M16 5c-6 0-10 4-10 10 0 6 4 10 10 10s10-4 10-10S22 5 16 5Z"/>',
    mood4: '<path d="M9 13h3M20 13h3M9 18c4 5 10 5 14 0"/><path d="M16 5c-6 0-10 4-10 10 0 6 4 10 10 10s10-4 10-10S22 5 16 5Z"/><path d="m7 7-2-2M25 7l2-2"/>',
    star: '<path d="m16 5 3.3 6.7 7.4 1.1-5.4 5.2 1.3 7.4-6.6-3.5-6.6 3.5 1.3-7.4-5.4-5.2 7.4-1.1Z"/>',
    menu: '<path d="M7 10h18M7 16h18M7 22h18"/>',
    chevrons: '<path d="M18 7 9 16l9 9M26 7l-9 9 9 9"/>',
    flame: '<path d="M16 3c1.5 5-4 7-4 12a4 4 0 0 0 8 0c0-1.8-.8-3-.8-3 2.3 1.6 3.8 3.7 3.8 6A7 7 0 0 1 9 18c0-7 5.5-9 7-15Z"/>',
    gift: '<path d="M7 12h18v13a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1Z"/><path d="M6 9h20v3H6Z"/><path d="M16 9v17"/><path d="M16 9c-4.5 0-7-1.7-7-3.5A2.5 2.5 0 0 1 11.5 3c2.7 0 4.5 3 4.5 6Zm0 0c4.5 0 7-1.7 7-3.5A2.5 2.5 0 0 0 20.5 3C17.8 3 16 6 16 9Z"/>',
    todo: '<path d="M12 6H8.5A1.5 1.5 0 0 0 7 7.5v18A1.5 1.5 0 0 0 8.5 27h15a1.5 1.5 0 0 0 1.5-1.5v-18A1.5 1.5 0 0 0 23.5 6H20"/><path d="M12 4h8v4h-8Z"/><path d="m12 17 2.5 2.5L19 15"/><path d="M13 24h6"/>',
    countdown: '<path d="M9 4h14M9 28h14"/><path d="M11 4v3c0 4 4.5 6 5 9-.5 3-5 5-5 9v3"/><path d="M21 4v3c0 4-4.5 6-5 9 .5 3 5 5 5 9v3"/>',
  };

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function safeClassName(value) {
    return String(value || '').replace(/[^a-zA-Z0-9_-]/g, '');
  }

  function iconSvg(name, options) {
    const opts = options || {};
    const key = Object.prototype.hasOwnProperty.call(PATHS, name) ? name : 'unknown';
    const size = Number(opts.size) > 0 ? Number(opts.size) : 18;
    const label = opts.label ? String(opts.label) : '';
    const extra = safeClassName(opts.className);
    const className = 'ui-icon' + (extra ? ' ' + extra : '');
    const labelAttrs = label
      ? ' role="img" aria-label="' + escapeHtml(label) + '"'
      : ' aria-hidden="true"';
    return '<svg class="' + className + '" data-icon="' + key + '" viewBox="0 0 32 32" width="' + size + '" height="' + size + '" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"' + labelAttrs + '>' + PATHS[key] + '</svg>';
  }

  function iconText(name, text, options) {
    return iconSvg(name, options) + '<span class="icon-label">' + escapeHtml(text) + '</span>';
  }

  return { PATHS, iconSvg, iconText };
});
