const test = require('node:test');
const assert = require('node:assert/strict');
const { TOOL_GROUPS, validateToolRegistry } = require('../src/renderer/shared/tool-registry.js');
const { PATHS } = require('../src/renderer/shared/icons.js');
const I18N = require('../src/renderer/home/content/i18n.js');

test('built-in tool registry passes its own validation', () => {
  assert.deepEqual(validateToolRegistry(TOOL_GROUPS, PATHS), []);
});

test('every group title and tool label/title key exists in both zh and en', () => {
  const errors = [];
  TOOL_GROUPS.forEach((group) => {
    ['zh', 'en'].forEach((lang) => {
      const dict = I18N[lang] || {};
      if (!dict[group.titleKey]) errors.push(lang + ': group "' + group.id + '" missing key ' + group.titleKey);
      group.tools.forEach((tool) => {
        if (!dict[tool.labelKey]) errors.push(lang + ': tool "' + tool.id + '" missing key ' + tool.labelKey);
        if (tool.titleKey && !dict[tool.titleKey]) errors.push(lang + ': tool "' + tool.id + '" missing title key ' + tool.titleKey);
      });
    });
  });
  assert.deepEqual(errors, []);
});

test('registry keeps ids unique across groups', () => {
  const ids = TOOL_GROUPS.flatMap((g) => g.tools.map((tool) => tool.id));
  assert.equal(new Set(ids).size, ids.length);
});

test('validateToolRegistry reports unknown icons, duplicate ids and bad kinds', () => {
  const bad = [
    {
      id: 'g',
      tools: [
        { id: 'x', icon: 'nope', labelKey: 'settings', kind: 'action' },
        { id: 'x', icon: 'more', labelKey: '', kind: 'weird' },
        { id: 'y', icon: 'more', labelKey: 'settings', kind: 'action', titleKey: 42 }
      ]
    }
  ];
  const errors = validateToolRegistry(bad, PATHS);
  assert.ok(errors.some((e) => e.includes('unknown icon')));
  assert.ok(errors.some((e) => e.includes('duplicate id')));
  assert.ok(errors.some((e) => e.includes('missing labelKey')));
  assert.ok(errors.some((e) => e.includes('kind must be')));
  assert.ok(errors.some((e) => e.includes('invalid titleKey')));
});
