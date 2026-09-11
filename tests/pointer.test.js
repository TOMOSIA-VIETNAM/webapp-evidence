// Where the real mouse pointer gets parked while a screen is recorded.
//
// The pointer is in the frame otherwise, and it never moves — Playwright clicks through the
// browser rather than by moving it — so what a take holds is a motionless arrow beside the one
// the runner draws and does move, which a reader takes for a fault in the application.
const test = require('node:test');
const assert = require('node:assert/strict');
const { parkTarget, supported } = require('../src/skills/recording/scripts/pointer');

const DISPLAY = { width: 1800, height: 1169 };
const WINDOW = { x: 0, y: 44, width: 1282, height: 880 };

test('the pointer is parked in the far corner of the display', () => {
  const target = parkTarget(WINDOW, DISPLAY);
  assert.deepEqual(
    { x: target.x, y: target.y },
    { x: DISPLAY.width - 1, y: DISPLAY.height - 1 },
  );
});

test('that corner is outside a window that does not reach it', () => {
  assert.equal(parkTarget(WINDOW, DISPLAY).outsideFrame, true);
});

test('a frame that is the whole display has nowhere outside it, and says so', () => {
  // Not a case to paper over: with `capture: 'screen'` the pointer stays in the video, and the
  // runner has to say that rather than imply it was handled.
  const wholeDisplay = { x: 0, y: 0, width: DISPLAY.width, height: DISPLAY.height };
  assert.equal(parkTarget(wholeDisplay, DISPLAY).outsideFrame, false);
});

test('a window filling the width still leaves the corner below it', () => {
  const wide = { x: 0, y: 0, width: DISPLAY.width, height: 600 };
  assert.equal(parkTarget(wide, DISPLAY).outsideFrame, true);
});

test('it is only implemented where it was measured', () => {
  assert.equal(supported(), process.platform === 'darwin');
});
