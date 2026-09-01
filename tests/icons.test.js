const test = require('node:test');
const assert = require('node:assert/strict');
const icons = require('../src/renderer/shared/icons.js');

test('iconSvg renders a named accessible icon without emoji characters', () => {
  const svg = icons.iconSvg('study', { label: '学习中' });
  assert.match(svg, /^<svg\b/);
  assert.match(svg, /data-icon="study"/);
  assert.match(svg, /aria-label="学习中"/);
  assert.doesNotMatch(svg, /📚|☕|🎉|⏭|⚙️|✕|✓/);
});

test('iconSvg falls back to a stable question mark icon for unknown names', () => {
  const svg = icons.iconSvg('not-in-catalog');
  assert.match(svg, /data-icon="unknown"/);
  assert.match(svg, /<path/);
});

test('iconText composes an icon and visible text for translated buttons', () => {
  const html = icons.iconText('notify', '启用系统提醒');
  assert.match(html, /data-icon="notify"/);
  assert.match(html, /<span class="icon-label">启用系统提醒<\/span>/);
});
