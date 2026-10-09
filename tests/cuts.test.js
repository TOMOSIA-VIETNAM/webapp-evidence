// Stretches taken out of the finished video, and where the timestamps land once they have been.
// All of it is arithmetic and ffmpeg argument strings, so none of it needs a video — which
// matters, because the failures here are silent: a graph that joins the wrong frames still
// encodes, and a runbook whose seconds are stale still reads as a runbook.
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  createCuts, buildFilter, shiftTime, unionBox, padBox, mergeRanges, keptSegments,
} = require('../src/skills/recording/scripts/cuts');

const region = { x: 40, y: 60, width: 200, height: 30 };

test('a take with nothing cut gets no filter at all', () => {
  assert.equal(buildFilter([], 0), null);
});

test('a removed stretch splits the stream before trimming, and concatenates what is left', () => {
  const { graph, removed } = buildFilter([{ from: 5, to: 8 }], 2);
  // A filter pad can be consumed once, so both kept segments cannot read the same label
  assert.match(graph, /split=2/);
  assert.match(graph, /trim=start=0:end=3/);
  assert.match(graph, /trim=start=6/);      // the last segment runs to the end of the source
  assert.match(graph, /concat=n=2:v=1:a=0/);
  assert.deepEqual(removed, [{ from: 3, to: 6 }]);
});

// ---------- the held frames at a join ----------

const { TRANSITION } = require('../src/skills/recording/scripts/style');
const JOIN = TRANSITION.holdBefore + TRANSITION.fadeOut + TRANSITION.fadeIn + TRANSITION.holdAfter;
const count = (graph, pattern) => (graph.match(pattern) || []).length;

test('a cut in the middle holds the frame on each side of the join, once', () => {
  const { graph, inserted } = buildFilter([{ from: 5, to: 8 }], 2);
  assert.equal(count(graph, /stop_mode=clone/g), 1);
  assert.equal(count(graph, /start_mode=clone/g), 1);
  // One shaded copy fading in over the held last frame, one fading out over the held first one
  assert.equal(count(graph, /fade=t=in/g), 1);
  assert.equal(count(graph, /fade=t=out/g), 1);
  assert.deepEqual(inserted, [{ at: 6, duration: JOIN }]);
});

test('the shading starts once the frame has been held, so nothing moving is under it', () => {
  // Kept 0..3, so the last frame is held from 3, still for holdBefore, then fades for fadeOut
  const { graph } = buildFilter([{ from: 5, to: 8 }], 2);
  const at = 3 + TRANSITION.holdBefore;
  assert.match(graph, new RegExp(`trim=start=${at},[^;]*fade=t=in:st=${at}:d=${TRANSITION.fadeOut}`));
  // The next segment opens shaded and is clear by the end of fadeIn, then held sharp
  assert.match(graph, new RegExp(`trim=end=${TRANSITION.fadeIn},[^;]*fade=t=out:st=0:d=${TRANSITION.fadeIn}`));
  assert.match(graph, new RegExp(`start_duration=${TRANSITION.fadeIn + TRANSITION.holdAfter}`));
});

test('padding comes before setpts, which would otherwise leave tpad with no frame rate to pad in', () => {
  const { graph } = buildFilter([{ from: 5, to: 8 }], 2);
  for (const step of graph.split(';').filter((s) => s.includes('tpad='))) {
    assert.ok(step.indexOf('tpad=') < step.indexOf('setpts='), step);
  }
});

test('two cuts make two joins, and the segment between them is held at both ends', () => {
  const { graph, inserted } = buildFilter([
    { from: 4, to: 6 },
    { from: 10, to: 12 },
  ], 0);
  assert.equal(inserted.length, 2);
  assert.equal(count(graph, /stop_mode=clone/g), 2);
  assert.equal(count(graph, /start_mode=clone/g), 2);
  assert.match(graph, /start_mode=clone:start_duration=[\d.]+:stop_mode=clone/);
});

test('a stretch cut from the start of the take has no scene before it, so nothing is held', () => {
  const { graph, inserted } = buildFilter([{ from: 0, to: 3 }], 0);
  assert.deepEqual(inserted, []);
  assert.doesNotMatch(graph, /tpad|fade=/);
});

test('the video is the kept footage plus one join for every place two stretches meet', () => {
  // 30s after the trim; 3s and 4s removed from the middle
  const { removed, inserted } = buildFilter([
    { from: 5, to: 8 },
    { from: 15, to: 19 },
  ], 0);
  const kept = 30 - removed.reduce((sum, r) => sum + r.to - r.from, 0);
  const length = kept + inserted.reduce((sum, i) => sum + i.duration, 0);
  assert.equal(Number(length.toFixed(3)), Number((23 + 2 * JOIN).toFixed(3)));
});

test('a moment after a join moves later by the held frames, one before it does not', () => {
  const removed = [{ from: 3, to: 6 }];
  const inserted = [{ at: 6, duration: JOIN }];
  assert.equal(shiftTime(2, removed, inserted), 2);
  assert.equal(shiftTime(10, removed, inserted), 7 + JOIN);
  // The first instant of the cut is where the join is, not inside the cut
  assert.equal(shiftTime(3, removed, inserted), 3);
  assert.equal(shiftTime(4, removed, inserted), null);
});

test('the first moment after a join has a place, whatever the stretch ends on', () => {
  // 38.859 - 1.172 is 37.687000000000005 in floating point: the join has to sit on that same value
  const { removed, inserted } = buildFilter([{ from: 35.813, to: 38.859 }], 1.172);
  assert.notEqual(shiftTime(inserted[0].at, removed, inserted), null);
});

test('a stretch removed from the very start leaves one segment', () => {
  const { graph } = buildFilter([{ from: 0, to: 3 }], 0);
  assert.doesNotMatch(graph, /concat=n=2/);
  assert.match(graph, /trim=start=3/);
});

test('an unfinished stretch never reaches the encode', () => {
  // A take that failed before the cut was closed has nothing to remove
  const cuts = createCuts();
  const open = cuts.open({ reason: 'picker' });
  open.from = 4;
  assert.deepEqual(cuts.all(), []);
  open.to = 6;
  assert.equal(cuts.all().length, 1);
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

test('a cut with a reason merged with one without keeps a place for both', () => {
  const [merged] = mergeRanges([{ from: 1, to: 5, reason: 'picker' }, { from: 3, to: 8 }]);
  assert.deepEqual(merged, { from: 1, to: 8, reasons: ['picker', null] });
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

test('an element measured twice is boxed where it was and where it grew to', () => {
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

test('a stretch that opened and closed in the same instant still reaches the encode', () => {
  // Given no width it would be filtered out, and the frame it was cut for would stay in the video
  const cuts = createCuts();
  const entry = cuts.open({ reason: 'picker' });
  cuts.close(entry, 12.5, 12.5);

  const [kept] = cuts.all();
  assert.ok(kept, 'the stretch never reached the encode');
  assert.ok(kept.to > kept.from, `${kept.from} → ${kept.to}`);
});

test('a stretch with real duration keeps the end it was given', () => {
  const cuts = createCuts();
  const entry = cuts.open({ reason: 'picker' });
  cuts.close(entry, 2, 9);
  assert.deepEqual(cuts.all().map((e) => [e.from, e.to]), [[2, 9]]);
});

test('the floor on a stretch removes a frame at the slowest rate a recording may run at', () => {
  // `recording.screenCapture.framerate` goes down to 5, where a frame is a fifth of a second. A
  // floor shorter than the frame it is meant to remove lands between two of them and removes neither.
  const cuts = createCuts();
  const entry = cuts.open({ reason: 'picker' });
  cuts.close(entry, 4, 4);

  const [kept] = cuts.all();
  assert.ok(kept.to - kept.from >= 1 / 5, `${kept.to - kept.from}s does not reach a frame at 5fps`);
});
