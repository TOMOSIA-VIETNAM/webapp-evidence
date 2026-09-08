// The sheets are only useful if a tile can be turned back into a time — a finding of "somewhere in
// the second picture" is not actionable. So what is pinned here is the arithmetic that maps tiles to
// seconds, and the filter chain that stamps them.
const test = require('node:test');
const assert = require('node:assert/strict');

const {
  DEFAULTS, parseArgs, resolveOptions, buildFilter, sheetRanges, mmss,
} = require('../src/skills/vision/scripts/contact-sheet');

const FONT = '/fake/font.ttf';

test('a video path is the only required argument', () => {
  const args = parseArgs(['take.mp4']);
  assert.equal(args.video, 'take.mp4');
  assert.deepEqual(resolveOptions(args.options), DEFAULTS);
});

test('options are read as numbers and override one at a time', () => {
  const args = parseArgs(['t.mp4', '--every', '5', '--columns', '3']);
  const options = resolveOptions(args.options);
  assert.equal(options.every, 5);
  assert.equal(options.columns, 3);
  assert.equal(options.rows, DEFAULTS.rows, 'an untouched option changed');
});

test('a nonsense interval is refused rather than passed to ffmpeg', () => {
  // fps=1/0 produces an error deep inside ffmpeg that says nothing about --every.
  assert.throws(() => resolveOptions({ every: 0 }), /--every/);
  assert.throws(() => resolveOptions({ every: -3 }), /--every/);
});

test('the filter samples, scales, stamps and tiles, in that order', () => {
  const filter = buildFilter(DEFAULTS, FONT);
  const order = ['fps=', 'scale=', 'drawtext=', 'tile='].map((part) => filter.indexOf(part));
  assert.ok(order.every((i) => i >= 0), filter);
  assert.deepEqual(order, [...order].sort((a, b) => a - b), 'filters are out of order');
});

test('the stamp is mm:ss, matching the runbook timeline', () => {
  // A sheet and a runbook that number time differently cannot be read together.
  const filter = buildFilter(DEFAULTS, FONT);
  assert.match(filter, /trunc\(t\/60\)/);
  assert.match(filter, /mod\(trunc\(t\)/);
});

test('with no font the sheets are still produced, just unstamped', () => {
  // A machine without a usable font should get sheets it can read, not an error it cannot fix.
  const filter = buildFilter(DEFAULTS, null);
  assert.ok(!filter.includes('drawtext'), filter);
  assert.match(filter, /tile=/);
});

test('a tile can be turned back into a time', () => {
  const options = { ...DEFAULTS, every: 2, columns: 4, rows: 5 };  // 20 tiles, 40s a sheet
  const ranges = sheetRanges(90, options);
  assert.equal(ranges.length, 3);
  assert.deepEqual(ranges[0], { index: 1, from: 0, to: 40 });
  assert.deepEqual(ranges[1], { index: 2, from: 40, to: 80 });
  assert.equal(ranges[2].to, 90, 'the last sheet claims more than the video holds');
});

test('a video shorter than one sampling interval still reports a sheet', () => {
  const ranges = sheetRanges(1.2, DEFAULTS);
  assert.equal(ranges.length, 1);
  assert.equal(ranges[0].from, 0);
});

test('times are printed the way the runbook prints them', () => {
  assert.equal(mmss(0), '00:00');
  assert.equal(mmss(9.6), '00:10');
  assert.equal(mmss(61), '01:01');
  assert.equal(mmss(-5), '00:00');
});
