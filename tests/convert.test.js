// Converting a take is one ffmpeg call away, so what is worth testing is everything around it: that
// a format nobody supports stops the run instead of silently producing nothing, and that the gif
// defaults stay where the side-by-side comparison put them.
const test = require('node:test');
const assert = require('node:assert/strict');

const { FORMATS, parseArgs, assertFormats } = require('../src/skills/recording/scripts/convert');

test('a video and one format is the whole command', () => {
  const args = parseArgs(['take.mp4', '--to', 'gif']);
  assert.equal(args.video, 'take.mp4');
  assert.deepEqual(args.formats, ['gif']);
});

test('several formats in one run', () => {
  assert.deepEqual(parseArgs(['t.mp4', '--to', 'gif,webm']).formats, ['gif', 'webm']);
  assert.deepEqual(parseArgs(['t.mp4', '--to', 'gif, webm']).formats, ['gif', 'webm']);
});

test('overrides are read as numbers, so a typo does not become a string in an ffmpeg argument', () => {
  const { options } = parseArgs(['t.mp4', '--to', 'gif', '--width', '640', '--fps', '6', '--colors', '64']);
  assert.deepEqual(options, { width: 640, fps: 6, colors: 64 });
});

test('an unknown format stops the run and names what is available', () => {
  assert.throws(() => assertFormats(['mov']), /mov/);
  assert.throws(() => assertFormats(['mov']), /gif/);
});

test('asking for no format at all is a mistake, not a no-op', () => {
  // Silently doing nothing leaves the user looking for a file that was never written.
  assert.throws(() => assertFormats([]), /--to/);
});

test('every supported format is complete enough to run', () => {
  for (const [name, spec] of Object.entries(FORMATS)) {
    assert.match(spec.extension, /^\.\w+$/, name);
    assert.equal(typeof spec.describe, 'function', name);
    assert.ok(Object.keys(spec.defaults).length > 0, name);
    assert.equal(typeof spec.describe(spec.defaults), 'string', name);
  }
});

test('the gif is encoded wider than a README displays it', () => {
  // A gif shown wider than it was encoded is scaled up by the browser and the text goes soft. The
  // README displays at 820, so the default has to clear that.
  assert.ok(FORMATS.gif.defaults.width >= 820, `gif default is ${FORMATS.gif.defaults.width}px`);
});

test('webm keeps the source resolution unless asked otherwise', () => {
  // Unlike the gif it is played as a video, so there is no display width to encode against.
  assert.equal(FORMATS.webm.defaults.width, 0);
  assert.ok(FORMATS.webm.defaults.crf > 0);
});
