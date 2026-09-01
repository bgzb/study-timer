const test = require('node:test');
const assert = require('node:assert/strict');
const theme = require('../src/renderer/shared/theme-model.js');

test('panel theme normalizes stored values and toggles paper and glass', () => {
  assert.equal(theme.normalizePanelTheme('glass'), 'glass');
  assert.equal(theme.normalizePanelTheme('unexpected'), 'paper');
  assert.equal(theme.nextPanelTheme('paper'), 'glass');
  assert.equal(theme.nextPanelTheme('glass'), 'paper');
});
