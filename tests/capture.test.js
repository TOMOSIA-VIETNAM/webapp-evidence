// The arithmetic and the parsing behind recording the screen. None of it needs a screen, which
// is the point: these are the parts that fail quietly. A crop rectangle that ignores the
// display's scale still encodes — into a video showing a quarter of the window.
const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const {
  assertConsent, assertReadable, assertWindowFits, parseScreenDevices, cropFor,
  createProgressReader, stopRecorder, CONSENT_ENV,
} = require('../src/skills/recording/scripts/capture');

// ---------- consent ----------

test('recording the page needs no agreement, because it records nothing else', () => {
  assert.doesNotThrow(() => assertConsent('page', {}));
});

test('recording the screen without agreement is refused, not prompted for', () => {
  // The runner is started by an agent through a shell: a prompt on stdin would wait forever.
  assert.throws(() => assertConsent('window', {}), new RegExp(CONSENT_ENV));
  assert.throws(() => assertConsent('screen', {}), new RegExp(CONSENT_ENV));
});

test('the refusal says how to keep recording without a screen at all', () => {
  assert.throws(() => assertConsent('window', {}), /"page"/);
});

test('agreement given, it proceeds', () => {
  assert.doesNotThrow(() => assertConsent('window', { [CONSENT_ENV]: '1' }));
});

// ---------- which device is the screen ----------

const LISTING = `[AVFoundation indev @ 0x7fcc59] AVFoundation video devices:
[AVFoundation indev @ 0x7fcc59] [0] MacBook Pro Camera
[AVFoundation indev @ 0x7fcc59] [1] Capture screen 0
[AVFoundation indev @ 0x7fcc59] [2] Capture screen 1
[AVFoundation indev @ 0x7fcc59] AVFoundation audio devices:
[AVFoundation indev @ 0x7fcc59] [0] MacBook Pro Microphone`;

test('a screen is found by its display number, not by its position in the list', () => {
  // Plugging in a camera renumbers the list, so the index cannot be written down anywhere
  const devices = parseScreenDevices(LISTING);
  assert.deepEqual(devices, [{ index: 1, display: 0 }, { index: 2, display: 1 }]);
});

test('a machine with no display reports no screens rather than guessing one', () => {
  assert.deepEqual(parseScreenDevices('[0] Some Camera'), []);
});

// ---------- the rectangle ----------

test('on an ordinary display the rectangle is used as measured', () => {
  assert.deepEqual(
    cropFor({ x: 0, y: 0, width: 1280, height: 920 }, 1),
    { x: 0, y: 0, width: 1280, height: 920 },
  );
});

test('on a Retina display every number doubles', () => {
  // Skipping this records a quarter of the window, and it looks fine until someone watches it
  assert.deepEqual(
    cropFor({ x: 0, y: 0, width: 1280, height: 920 }, 2),
    { x: 0, y: 0, width: 2560, height: 1840 },
  );
});

test('a window away from the origin keeps its offset', () => {
  assert.deepEqual(
    cropFor({ x: 100, y: 50, width: 800, height: 600 }, 2),
    { x: 200, y: 100, width: 1600, height: 1200 },
  );
});

test('every number comes out even, because h264 in yuv420p cannot take an odd one', () => {
  const crop = cropFor({ x: 10.5, y: 7.5, width: 801, height: 599 }, 1.5);
  for (const value of Object.values(crop)) assert.equal(value % 2, 0, `${value} is odd`);
});

test('a rectangle never starts off the screen', () => {
  const crop = cropFor({ x: -3, y: -1, width: 100, height: 100 }, 1);
  assert.equal(crop.x, 0);
  assert.equal(crop.y, 0);
});

test('an odd size rounds down, never past the edge of what was captured', () => {
  // Rounding a width of 1281 up to 1282 asks for a pixel that is not there, and ffmpeg refuses
  // the crop — after the take has already been recorded.
  const crop = cropFor({ x: 0, y: 0, width: 1281, height: 921 }, 1, { width: 1281, height: 921 });
  assert.equal(crop.width, 1280);
  assert.equal(crop.height, 920);
});

test('a window hanging off the edge of the display is clamped to it', () => {
  const crop = cropFor({ x: 900, y: 0, width: 1280, height: 800 }, 1, { width: 1440, height: 900 });
  assert.equal(crop.x + crop.width, 1440);
  assert.ok(crop.height <= 900);
});

// ---------- stopping the recorder ----------

// The real waits are seconds long, which is right for a recorder and wrong for a test suite
const FAST = { quietMs: 20, termMs: 20 };

function fakeRecorder({ respondsTo }) {
  const child = new EventEmitter();
  const stop = (by) => setTimeout(() => child.emit('exit', 0), 5);
  child.stdin = { write: () => { if (respondsTo === 'q') stop('q'); } };
  child.kill = (signal) => {
    if (respondsTo === 'interrupt' && signal === 'SIGINT') stop('interrupt');
    if (signal === 'SIGKILL') stop('kill');
  };
  return child;
}

test('a recorder that takes the stop request is left to finish its file', async () => {
  assert.equal(await stopRecorder(fakeRecorder({ respondsTo: 'q' })), 'q');
});

test('one that ignores it is interrupted, which still writes a file that plays', async () => {
  // Without this the take is over, the runner is idle, and the screen carries on being recorded
  const stopped = await stopRecorder(fakeRecorder({ respondsTo: 'interrupt' }), FAST);
  assert.equal(stopped, 'interrupt');
});

test('one that ignores everything is killed, and the caller is told which happened', async () => {
  assert.equal(await stopRecorder(fakeRecorder({ respondsTo: 'nothing' }), FAST), 'kill');
});

// ---------- when the recording actually began ----------

function firstFrameFrom(chunks) {
  let calls = 0;
  const read = createProgressReader(() => { calls += 1; });
  chunks.forEach(read);
  return calls;
}

test('the first frame written is what starts the clock', () => {
  assert.equal(firstFrameFrom(['frame=1\nfps=0.0\n']), 1);
});

test('a progress block split across two reads is still recognised', () => {
  assert.equal(firstFrameFrom(['fra', 'me=1\nfps=0.0\n']), 1);
});

test('only the first frame starts the clock, however many follow', () => {
  assert.equal(firstFrameFrom(['frame=1\n', 'frame=2\n', 'frame=3\n']), 1);
});

test('progress output that has not reached a frame yet starts nothing', () => {
  assert.equal(firstFrameFrom(['bitrate=N/A\nout_time_ms=0\n']), 0);
});

// ---------- the file the recorder left behind ----------

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'evidence-capture-'));

test('a capture that cannot be read back is reported as that, not left to the encoder', () => {
  // An mp4 with no index fails the encode with a message about atoms, which says nothing about
  // screen recording and sends whoever reads it looking in the wrong place.
  const broken = path.join(scratch, 'broken.mp4');
  fs.writeFileSync(broken, Buffer.from('not a video'));
  assert.throws(() => assertReadable(broken, 'kill'), /cannot be read back/);
});

test('a capture that plays passes, however it was stopped', () => {
  const good = path.join(scratch, 'good.mp4');
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-f', 'lavfi',
    '-i', 'testsrc=size=64x64:rate=10:duration=0.5', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', good]);
  assert.doesNotThrow(() => assertReadable(good, 'kill'));
});

// ---------- does the window fit on the display ----------

const geometry = (over = {}) => ({
  x: 0, y: 44, width: 1280, height: 920, chromeHeight: 120, scale: 1,
  screen: { width: 1280, height: 800 },
  usable: { x: 0, y: 25, width: 1280, height: 775 },
  ...over,
});

test('a window that fits is recorded without comment', () => {
  assert.doesNotThrow(() => assertWindowFits(
    geometry({ height: 700, usable: { x: 0, y: 25, width: 1280, height: 775 } }),
    { width: 1280, height: 580 },
  ));
});

test('a window taller than the display is refused before anything is recorded', () => {
  // macOS places it anyway, with the bottom off the screen, and the capture records what is
  // left: a video of a clipped application that looks like the application is clipped.
  assert.throws(() => assertWindowFits(geometry(), { width: 1280, height: 800 }), /does not fit/);
});

test('the refusal names the size that would fit, and why it is smaller than the display', () => {
  assert.throws(
    () => assertWindowFits(geometry(), { width: 1280, height: 800 }),
    (e) => /1280x655/.test(e.message) && /120px/.test(e.message),
  );
});

test('a window hanging off the right edge is refused too', () => {
  assert.throws(
    () => assertWindowFits(geometry({ width: 1600, height: 600 }), { width: 1600, height: 480 }),
    /does not fit/,
  );
});
