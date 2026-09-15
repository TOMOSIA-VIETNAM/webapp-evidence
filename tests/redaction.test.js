// What is kept out of the finished video, and where the timestamps land once a stretch has been
// removed. All of it is arithmetic and ffmpeg argument strings, so none of it needs a video —
// which matters, because the failures here are silent: a filter that covers the wrong rectangle
// still encodes, and a runbook whose seconds are stale still reads as a runbook.
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  createRedactions, buildFilter, shiftTime, unionBox, padBox, mergeRanges, keptSegments,
} = require('../src/skills/recording/scripts/redaction');

const region = { x: 40, y: 60, width: 200, height: 30 };

test('a take with nothing to hide gets no filter at all', () => {
  assert.equal(buildFilter([], 0), null);
});

test('a solid block is drawn over the region, only while it is showing', () => {
  const { graph } = buildFilter([{ mode: 'box', box: region, from: 5, to: 9 }], 2);
  assert.match(graph, /drawbox=x=40:y=60:w=200:h=30/);
  assert.match(graph, /color=black@1:t=fill/);
  // The encode seeks past the page-load wait first, so the window is rebased on that point
  assert.match(graph, /between\(t,3,7\)/);
});

test('covering the whole frame needs no rectangle', () => {
  const { graph } = buildFilter([{ mode: 'box', box: null, from: 1, to: 2 }], 0);
  assert.match(graph, /drawbox=x=0:y=0:w=iw:h=ih/);
});

test('blurring a region crops it out, blurs it, and lays it back in place', () => {
  const { graph } = buildFilter([{ mode: 'blur', box: region, from: 1, to: 4 }], 0);
  assert.match(graph, /split=2/);
  assert.match(graph, /crop=200:30:40:60/);
  assert.match(graph, /boxblur/);
  assert.match(graph, /overlay=40:60:enable='between\(t,1,4\)'/);
});

test('the blur states a chroma radius of its own', () => {
  // The chroma planes are half-resolution, so a radius that is legal on luma is rejected there,
  // and leaving it to default to the luma value fails the encode.
  const { graph } = buildFilter([{ mode: 'blur', box: region, from: 1, to: 4 }], 0);
  assert.match(graph, /chroma_radius/);
});

test('blurring the whole frame skips the crop', () => {
  const { graph } = buildFilter([{ mode: 'blur', box: null, from: 1, to: 4 }], 0);
  assert.doesNotMatch(graph, /crop=/);
  assert.match(graph, /boxblur/);
});

test('two regions are chained, the second reading what the first produced', () => {
  const { graph, label } = buildFilter([
    { mode: 'box', box: region, from: 1, to: 3 },
    { mode: 'box', box: { x: 0, y: 0, width: 10, height: 10 }, from: 2, to: 4 },
  ], 0);
  const steps = graph.split(';');
  const first = steps[0].match(/\[(v\d+)\]$/)[1];
  assert.ok(steps[1].startsWith(`[${first}]`), `${steps[1]} does not read ${first}`);
  assert.equal(label, steps[steps.length - 1].match(/\[(v\d+)\]$/)[1]);
});

test('a removed stretch splits the stream before trimming, and concatenates what is left', () => {
  const { graph, removed } = buildFilter([{ mode: 'cut', box: null, from: 5, to: 8 }], 2);
  // A filter pad can be consumed once, so both kept segments cannot read the same label
  assert.match(graph, /split=2/);
  assert.match(graph, /trim=start=0:end=3/);
  assert.match(graph, /trim=start=6/);      // the last segment runs to the end of the source
  assert.match(graph, /concat=n=2:v=1:a=0/);
  assert.deepEqual(removed, [{ from: 3, to: 6 }]);
});

test('a region is covered before anything is removed, so it stays covered in what is kept', () => {
  const { graph } = buildFilter([
    { mode: 'blur', box: region, from: 1, to: 2 },
    { mode: 'cut', box: null, from: 4, to: 7 },
  ], 0);
  assert.ok(graph.indexOf('overlay') < graph.indexOf('trim='), 'the cut was applied first');
});

test('a stretch removed from the very start leaves one segment', () => {
  const { graph } = buildFilter([{ mode: 'cut', box: null, from: 0, to: 3 }], 0);
  assert.doesNotMatch(graph, /concat=n=2/);
  assert.match(graph, /trim=start=3/);
});

test('an unfinished stretch never reaches the encode', () => {
  // A step script that threw halfway should not blur everything after the point it failed
  const redactions = createRedactions();
  const open = redactions.open({ mode: 'blur', box: null });
  open.from = 4;
  assert.deepEqual(redactions.all(), []);
  open.to = 6;
  assert.equal(redactions.all().length, 1);
});

// ---------- where the timestamps land ----------

test('overlapping removals count as one, so the same second is not subtracted twice', () => {
  assert.deepEqual(
    mergeRanges([{ from: 1, to: 5 }, { from: 3, to: 8 }]),
    [{ from: 1, to: 8 }],
  );
});

test('removals are merged whatever order they were declared in', () => {
  assert.deepEqual(
    mergeRanges([{ from: 10, to: 12 }, { from: 1, to: 3 }]),
    [{ from: 1, to: 3 }, { from: 10, to: 12 }],
  );
});

test('a segment too short to see is not kept', () => {
  const kept = keptSegments([{ from: 0, to: 5 }, { from: 5.01, to: 9 }]);
  assert.deepEqual(kept, [{ start: 9, end: Infinity }]);
});

test('a moment before a removal keeps its timestamp', () => {
  assert.equal(shiftTime(2, [{ from: 5, to: 8 }]), 2);
});

test('a moment after a removal moves earlier by exactly what was taken out', () => {
  assert.equal(shiftTime(10, [{ from: 5, to: 8 }]), 7);
});

test('a moment inside a removal has nowhere to point, and says so', () => {
  assert.equal(shiftTime(6, [{ from: 5, to: 8 }]), null);
});

test('several removals accumulate', () => {
  assert.equal(shiftTime(20, [{ from: 1, to: 3 }, { from: 10, to: 14 }]), 14);
});

// ---------- the rectangle ----------

test('a region measured twice covers where it was and where it went', () => {
  const moved = unionBox(
    { x: 10, y: 10, width: 100, height: 20 },
    { x: 40, y: 10, width: 100, height: 20 },
  );
  assert.deepEqual(moved, { x: 10, y: 10, width: 130, height: 20 });
});

test('measured only once, that measurement is used', () => {
  assert.deepEqual(unionBox(null, region), region);
  assert.deepEqual(unionBox(region, null), region);
});

test('the rectangle is padded, because text is antialiased against its background', () => {
  const padded = padBox({ x: 40, y: 60, width: 100, height: 20 }, 8, { width: 1280, height: 800 });
  assert.equal(padded.x, 32);
  assert.equal(padded.y, 52);
  assert.equal(padded.width, 116);
  assert.equal(padded.height, 36);
});

test('padding never takes the rectangle outside the frame', () => {
  const padded = padBox({ x: 2, y: 2, width: 100, height: 20 }, 8, { width: 110, height: 30 });
  assert.equal(padded.x, 0);
  assert.equal(padded.y, 0);
  assert.ok(padded.x + padded.width <= 110);
  assert.ok(padded.y + padded.height <= 30);
});
