const test = require('node:test');
const assert = require('node:assert/strict');
const timeline = require('../src/renderer/shared/timeline-model.js');

const hour = 60 * 60;

test('buildTimelineMarkers maps session starts and end to bounded percentages', () => {
  const markers = timeline.buildTimelineMarkers([
    { name: '上午', start: 9 * hour, end: 11 * hour },
    { name: '加钟', start: 11 * hour + 30 * 60, end: 12 * hour, isExtra: true }
  ], 9 * hour, 12 * hour);

  assert.deepEqual(markers, [
    { type: 'start', sessionIndex: 0, position: 0, isExtra: false },
    { type: 'start', sessionIndex: 1, position: 83.33333333333334, isExtra: true },
    { type: 'end', position: 100 }
  ]);
});

test('buildTimelineMarkers clamps out-of-range starts and handles short spans', () => {
  const markers = timeline.buildTimelineMarkers([
    { start: -10, end: 5, isExtra: false },
    { start: 5, end: 5, isExtra: true },
    { start: 15, end: 20, isExtra: true }
  ], 0, 0);

  assert.deepEqual(markers.map((marker) => marker.position), [0, 100, 100, 100]);
  assert.equal(markers[0].isExtra, false);
  assert.equal(markers[1].isExtra, true);
  assert.equal(markers[2].isExtra, true);
  assert.equal(markers[3].type, 'end');
});

test('buildTimelineMarkers returns no text label payload for adjacent sessions', () => {
  const markers = timeline.buildTimelineMarkers([
    { name: 'A', start: 100, end: 101 },
    { name: 'B', start: 101, end: 102, isExtra: true }
  ], 100, 102);

  assert.equal(markers.filter((marker) => marker.type === 'start').length, 2);
  assert.equal(Object.prototype.hasOwnProperty.call(markers[0], 'label'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(markers[1], 'label'), false);
});

test('timelineTooltipPosition centers above the target and clamps to the viewport', () => {
  assert.deepEqual(
    timeline.timelineTooltipPosition(
      { left: 100, right: 110, top: 100, bottom: 110 },
      { width: 80, height: 30 },
      { width: 300, height: 200 }
    ),
    { left: 65, top: 62 }
  );
  assert.deepEqual(
    timeline.timelineTooltipPosition(
      { left: 0, right: 4, top: 4, bottom: 12 },
      { width: 100, height: 30 },
      { width: 180, height: 100 }
    ),
    { left: 8, top: 20 }
  );
});
