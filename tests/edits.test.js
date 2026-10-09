// The edit list of a finished take and the clock arithmetic behind it. All of it is checked
// without a video: what goes wrong here is silent — a cover aimed at the wrong second still
// renders, and a runbook whose seconds are stale still reads as a runbook.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  editsFile, load, save, append, undo, reset, editedVideo, resolve, formatList,
} = require('../src/skills/recording/scripts/edits');
const { takeRemap, fadeWindows, JOIN } = require('../src/skills/recording/scripts/cuts');
const { DRAW } = require('../src/skills/recording/scripts/style');

// A 31s take with a 1s page-load trim and nothing removed: the recorded video is 30s, and a moment
// of the take is one second earlier on it.
const EMAIL = { x: 40, y: 60, width: 200, height: 30 };
const SAVE = { x: 300, y: 400, width: 80, height: 32 };
const TAKE = {
  trimAt: 1, removed: [], inserted: [], fades: [], duration: 30,
  marks: [
    { at: 2, label: 'Open the form', box: null },
    { at: 6, label: 'Fill in the email', box: EMAIL },
    { at: 12, label: 'Save', box: SAVE },
  ],
};

// Each request resolved against the list before it, as the command line applies them one by one
const build = (take, requests) => requests.reduce((edits, r) => append(edits, resolve(r, take, edits)), []);

// ---------- the list ----------

test('edits are kept in order, and undo drops the last one or the one numbered', () => {
  const a = { kind: 'cut', range: { from: 1, to: 2 } };
  const b = { kind: 'speed', factor: 2 };
  const c = { kind: 'trim', start: 3 };
  const edits = append(append(append([], a), b), c);
  assert.deepEqual(undo(edits).edits, [a, b]);
  assert.deepEqual(undo(edits).dropped, c);
  assert.deepEqual(undo(edits, 1).edits, [b, c]);
  assert.deepEqual(reset(), []);
  assert.throws(() => undo(edits, 4));
  assert.throws(() => undo(edits, 0));
  assert.throws(() => undo([]));
});

test('the list is kept beside what it edits and survives a round trip', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'evidence-edits-'));
  const video = path.join(dir, 'checkout.mp4');
  const file = editsFile(video);
  assert.equal(file, path.join(dir, 'checkout-edits.json'));
  assert.notEqual(editsFile(path.join(dir, '01-form.png')), file);
  assert.deepEqual(load(file), []);
  const edits = [{ kind: 'speed', factor: 2 }];
  save(file, edits);
  assert.deepEqual(load(file), edits);
});

// ---------- targets ----------

test('a step targets its element and runs to the next step, the last one to the end of the take', () => {
  const email = resolve({ kind: 'cover', step: 'Fill in the email' }, TAKE, []);
  assert.deepEqual(email.box, EMAIL);
  assert.deepEqual(email.range, { from: 6, to: 12 });
  assert.equal(email.step, 'Fill in the email');
  assert.deepEqual(resolve({ kind: 'cover', step: 'Save' }, TAKE, []).range, { from: 12, to: 31 });
});

test('an unknown step fails and names every step the take has', () => {
  assert.throws(() => resolve({ kind: 'cover', step: 'Pay' }, TAKE, []), (error) => (
    TAKE.marks.every((m) => error.message.includes(m.label))
  ));
});

test('a step that acted on no element needs a box given', () => {
  assert.throws(() => resolve({ kind: 'highlight', step: 'Open the form' }, TAKE, []));
  const given = resolve({ kind: 'cover', step: 'Open the form', box: '1,2,3,4' }, TAKE, []);
  assert.deepEqual(given.box, { x: 1, y: 2, width: 3, height: 4 });
});

// ---------- the forward map ----------

test('with no edits the edited video is the recorded one', () => {
  const video = editedVideo(TAKE, []);
  const remap = takeRemap(TAKE.trimAt);
  for (const at of [0, 1, 6, 12.5, 31]) assert.equal(video.toEdited(at), remap(at));
  assert.equal(video.duration, 30);
});

test('speeding the whole take up 2x halves every time and the duration', () => {
  const video = editedVideo(TAKE, build(TAKE, [{ kind: 'speed', factor: 2 }]));
  assert.equal(video.toEdited(11), 5);
  assert.equal(video.toEdited(21), 10);
  assert.equal(video.duration, 15);
});

test('a range speed-up moves only what is inside and after it', () => {
  // Recorded seconds 10 to 20 at 2x: 10s of footage plays in 5
  const video = editedVideo(TAKE, build(TAKE, [{ kind: 'speed', factor: 2, at: 10, to: 20 }]));
  assert.equal(video.toEdited(6), 5);
  assert.equal(video.toEdited(16), 12.5);
  assert.equal(video.toEdited(21), 15);
  assert.equal(video.toEdited(31), 25);
  assert.equal(video.duration, 25);
});

test('a cut and a speed-up give the same video whichever was asked for first', () => {
  // Take 6-11 is recorded 5-10, and on the 2x video 2.5-5
  const cutFirst = editedVideo(TAKE, build(TAKE, [
    { kind: 'cut', at: 5, to: 10 },
    { kind: 'speed', factor: 2 },
  ]));
  const speedFirst = editedVideo(TAKE, build(TAKE, [
    { kind: 'speed', factor: 2 },
    { kind: 'cut', at: 2.5, to: 5 },
  ]));
  for (const video of [cutFirst, speedFirst]) {
    assert.equal(video.toEdited(4), 1.5);
    assert.equal(video.toEdited(8), null);
    // 20 recorded, less the 5 cut, at half speed — and the held frames of the join at their own length
    assert.equal(video.toEdited(21), (20 - 5) / 2 + JOIN);
    assert.equal(video.duration, (30 - 5) / 2 + JOIN);
  }
});

test('a cut has a transition at its join, and one that reaches the end of the take has none', () => {
  const middle = editedVideo(TAKE, build(TAKE, [{ kind: 'cut', at: 10, to: 20 }]));
  assert.equal(middle.cut.inserted.length, 1);
  assert.equal(middle.duration, 30 - 10 + JOIN);
  const end = editedVideo(TAKE, build(TAKE, [{ kind: 'cut', at: 20, to: 30 }]));
  assert.equal(end.cut.inserted.length, 0);
  assert.equal(end.duration, 20);
  assert.equal(end.fades.length, 0);
});

test('a trim takes footage off either end with no transition', () => {
  const video = editedVideo(TAKE, build(TAKE, [{ kind: 'trim', start: 2, end: 25 }]));
  assert.equal(video.cut.inserted.length, 0);
  assert.equal(video.duration, 23);
  assert.equal(video.toEdited(4), 1);
  assert.equal(video.toEdited(2), null);
});

test('the dissolve at a join is where the edited video plays it, speed change included', () => {
  const edits = build(TAKE, [{ kind: 'cut', at: 5, to: 10 }]);
  // The second scene moves again at 5 + the held frames
  assert.deepEqual(editedVideo(TAKE, edits).fades, fadeWindows([5 + JOIN]));
  // At 2x the 5s before the join take 2.5, and the transition still takes its full length
  const fast = editedVideo(TAKE, [...edits, { kind: 'speed', factor: 2 }]);
  assert.deepEqual(fast.fades, fadeWindows([2.5 + JOIN]));
});

test('speed leaves the held frames of every join at their own length', () => {
  // The recording's own join, after recorded 5, and one a cut makes at recorded 15
  const take = {
    ...TAKE,
    removed: [{ from: 6, to: 9 }], inserted: [{ at: 9, duration: JOIN }], duration: 30 - 3 + JOIN,
  };
  const video = editedVideo(take, build(take, [
    { kind: 'cut', at: 15 + JOIN, to: 20 + JOIN },
    { kind: 'speed', factor: 4 },
  ]));
  const held = video.speed.filter((p) => p.factor === 1);
  assert.deepEqual(held.map((p) => Number((p.to - p.from).toFixed(3))), [JOIN, JOIN]);
  // 27 recorded seconds of footage less the 5 cut at 4x, and two joins at real time
  assert.equal(video.duration, Number(((30 - 3 - 5) / 4 + 2 * JOIN).toFixed(3)));
});

test('the recording\'s own dissolves move with the edits, and go when an edit cuts them out', () => {
  const take = {
    ...TAKE,
    removed: [{ from: 6, to: 9 }], inserted: [{ at: 9, duration: JOIN }], duration: 30 - 3 + JOIN,
  };
  take.fades = fadeWindows([takeRemap(take.trimAt, take.removed, take.inserted)(9)]);
  assert.deepEqual(editedVideo(take, []).fades, take.fades);
  // The 5s of footage before the join play in 2.5, the held frames as they were
  const fast = editedVideo(take, [{ kind: 'speed', factor: 2 }]);
  const earlier = (at) => Number((at - 2.5).toFixed(3));
  assert.deepEqual(fast.fades, take.fades.map((f) => ({ from: earlier(f.from), to: earlier(f.to) })));
  // Cutting across the recording's join leaves only the join the cut itself made
  const across = editedVideo(take, [{ kind: 'cut', range: { from: 3, to: 20 } }]);
  assert.deepEqual(across.fades, fadeWindows([2 + JOIN]));
});

// ---------- reading times off the edited video ----------

test('--at and --to read on a cut and sped-up video land on the take moments shown there', () => {
  const edits = build(TAKE, [{ kind: 'cut', at: 5, to: 10 }, { kind: 'speed', factor: 2 }]);
  const video = editedVideo(TAKE, edits);
  // The 5s kept before the join play in 2.5 and its held frames in their own 1.4, so edited 4 is
  // 0.1s into the footage after it: 0.2s of it at 2x — recorded 10.2, take 11.2
  const cover = resolve({ kind: 'cover', at: 4, to: 6, box: '0,0,10,10' }, TAKE, edits);
  assert.deepEqual(cover.range, { from: 11.2, to: 15.2 });
  for (const at of [1, 4, 6, 10]) assert.equal(video.toEdited(video.toTake(at)), at);
});

test('a moment on the held frames of a join resolves to the picture they hold', () => {
  const video = editedVideo(TAKE, build(TAKE, [{ kind: 'cut', at: 5, to: 10 }]));
  // The held frames play from 5 to 6.4: the frame before the join first, then the one after it
  assert.equal(video.toTake(5.2), 6);
  assert.equal(video.toTake(6.2), 11);
});

test('dropping an earlier speed edit leaves a later cover on the moment it was aimed at', () => {
  const edits = build(TAKE, [
    { kind: 'speed', factor: 2 },
    { kind: 'cover', at: 2, to: 4, box: '0,0,10,10' },
  ]);
  const cover = edits[1];
  assert.deepEqual(cover.range, { from: 5, to: 9 });
  const { edits: left } = undo(edits, 1);
  assert.deepEqual(left, [cover]);
  // Back on the unsped video it is where it always was in the footage: recorded 4 to 8
  const video = editedVideo(TAKE, left);
  assert.equal(video.toEdited(cover.range.from), 4);
  assert.equal(video.toEdited(cover.range.to), 8);
});

// ---------- marks long enough to see ----------

test('a highlight or arrow too short to draw and be seen is lengthened, and stored that way', () => {
  const highlight = resolve({ kind: 'highlight', at: 3, to: 3.5, box: '0,0,10,10' }, TAKE, []);
  assert.deepEqual(highlight.range, { from: 4, to: 4 + DRAW.outline + DRAW.still });
  const arrow = resolve({ kind: 'arrow', at: 3, to: 3.5, box: '0,0,10,10' }, TAKE, []);
  assert.deepEqual(arrow.range, { from: 4, to: 4 + DRAW.outline + DRAW.shaft + DRAW.still });
  // Against the end of the video it starts earlier instead
  const late = resolve({ kind: 'highlight', at: 29.8, to: 30, box: '0,0,10,10' }, TAKE, []);
  assert.deepEqual(late.range, { from: 31 - DRAW.outline - DRAW.still, to: 31 });
  // A cover has no drawing to wait for
  assert.deepEqual(resolve({ kind: 'cover', at: 3, to: 3.5, box: '0,0,10,10' }, TAKE, []).range, { from: 4, to: 4.5 });
});

// ---------- the list in words ----------

test('the list is numbered as undo counts, with times on the edited video', () => {
  const edits = build(TAKE, [
    { kind: 'speed', factor: 2 },
    { kind: 'highlight', step: 'Save' },
  ]);
  const lines = formatList(edits, TAKE).split('\n');
  assert.equal(lines.length, 2);
  assert.match(lines[0], /^1\. /);
  assert.match(lines[1], /^2\. .*Save/);
  // Save is take 12, recorded 11, at 2x 5.5 on the edited video
  assert.match(lines[1], /00:05\.5/);
});

test('a cut whose ends do not round evenly still joins, and the video after it has a length', () => {
  // The step times of a real take: 38.859 - 1.172 is 37.687000000000005 in floating point
  const take = {
    ...TAKE, trimAt: 1.172, duration: 66.92,
    marks: [{ at: 35.813, label: 'Travel', box: null }, { at: 38.859, label: 'Reveal', box: null }],
  };
  const video = editedVideo(take, build(take, [{ kind: 'cut', step: 'Travel' }]));
  assert.equal(video.fades.length, 1);
  assert.ok(Number.isFinite(video.duration));
});
