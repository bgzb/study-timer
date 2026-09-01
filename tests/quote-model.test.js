const test = require('node:test');
const assert = require('node:assert/strict');
const quotes = require('../src/renderer/shared/quote-model.js');

test('initial wait uses a start quote instead of a session-end template', () => {
  const st = { phase: 'wait', next: { idx: 0, name: '上午' } };
  assert.equal(quotes.poolForState(st), 'morningFirst');
  assert.equal(quotes.quoteForState(st, () => '{session}占位符'), '{session}占位符');
});

test('wait between sessions keeps the session-end quote pool', () => {
  const st = {
    phase: 'wait',
    prev: { idx: 0, name: '上午' },
    next: { idx: 1, name: '下午' }
  };
  assert.equal(quotes.poolForState(st), 'sessionEnd');
  assert.equal(quotes.quoteForState(st, () => '{session}完成'), '上午完成');
});
