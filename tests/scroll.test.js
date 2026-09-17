// What a viewer sees when the runner has to reach something off the fold: the page travels, the
// cursor follows, and the click lands on what the video shows. Every one of those decisions is
// geometry, so it is pinned here rather than watched for in a video — the failure it replaces was
// invisible on screen: the page stayed still and the cursor slid off the frame to click nothing.
const test = require('node:test');
const assert = require('node:assert/strict');

const { planHop, visibleBox, intersect, FOCUS, MARGIN } = require('../src/skills/recording/scripts/scroll');

const VIEW = { width: 1280, height: 800 };

// The window, as SNAPSHOT reports it: the last pane in the chain, covering the frame.
const windowPane = ({ scrollTop = 0, maxTop = 4000, scrollLeft = 0, maxLeft = 0 } = {}) => ({
  rect: { top: 0, left: 0, width: VIEW.width, height: VIEW.height },
  scrollTop, maxTop, scrollLeft, maxLeft,
});

const pane = ({ top, left = 100, width = 600, height = 400, scrollTop = 0, maxTop = 2000, scrollLeft = 0, maxLeft = 0 }) => ({
  rect: { top, left, width, height },
  scrollTop, maxTop, scrollLeft, maxLeft,
});

const snapshot = (target, frames) => ({ target, view: VIEW, frames });

test('an element comfortably inside the frame is not scrolled to at all', () => {
  const target = { top: 300, left: 200, width: 120, height: 40 };
  assert.equal(planHop(snapshot(target, [windowPane()])), null);
});

test('an element close to the edge but whole on screen is left where it is', () => {
  // The margin decides where something out of view lands; it does not make what is in view move.
  const target = { top: 752, left: 200, width: 120, height: 40 };
  const hop = planHop(snapshot(target, [windowPane()]));
  assert.equal(hop, null);
});

test('an element below the fold brings the page to it, and leaves it where a reader looks', () => {
  const target = { top: 1400, left: 200, width: 160, height: 40 };
  const { dx, dy, pointer } = planHop(snapshot(target, [windowPane()]));

  assert.equal(dx, 0);
  // Where it ends up: the focus line, not jammed against an edge.
  const landed = target.top - dy;
  assert.equal(Math.round(VIEW.height * FOCUS - target.height / 2), landed);
  // And the pointer is somewhere the wheel reaches the page.
  assert.ok(pointer.x > 0 && pointer.x < VIEW.width, String(pointer.x));
  assert.ok(pointer.y > 0 && pointer.y < VIEW.height, String(pointer.y));
});

test('an element above the fold scrolls back up, never past the top of the page', () => {
  const target = { top: -600, left: 200, width: 160, height: 40 };
  const { dy } = planHop(snapshot(target, [windowPane({ scrollTop: 200 })]));
  assert.ok(dy < 0, String(dy));
  assert.equal(dy, -200);   // the page only has 200px above it, so that is all it gives
});

test('the page is never asked to scroll further than it has', () => {
  const target = { top: 5000, left: 200, width: 160, height: 40 };
  const { dy } = planHop(snapshot(target, [windowPane({ scrollTop: 300, maxTop: 900 })]));
  assert.equal(dy, 600);
});

test('an element wider than the frame lines its leading edge up instead of centring nothing', () => {
  const target = { top: 2000, left: 0, width: 400, height: 1200 };
  const { dy } = planHop(snapshot(target, [windowPane()]));
  assert.equal(target.top - dy, MARGIN);
});

test('a list scrolls inside its own pane, and the wheel is delivered over that pane', () => {
  const list = pane({ top: 120, left: 100, width: 600, height: 400 });
  const target = { top: 900, left: 200, width: 160, height: 40 };   // below the pane's bottom edge

  const { dy, pointer } = planHop(snapshot(target, [list, windowPane()]));

  assert.ok(dy > 0, String(dy));
  assert.equal(target.top - dy, Math.round(list.rect.top + list.rect.height * FOCUS - target.height / 2));
  assert.ok(pointer.x > list.rect.left && pointer.x < list.rect.left + list.rect.width, String(pointer.x));
  assert.ok(pointer.y > list.rect.top && pointer.y < list.rect.top + list.rect.height, String(pointer.y));
});

test('a pane that is itself off screen waits: what holds it moves first', () => {
  // The pane starts below the fold, so no pointer can be put in it — the page has to come up
  // first, and only then can the pane be scrolled. One hop at a time, outermost first.
  const list = pane({ top: 1500, height: 400, scrollTop: 0, maxTop: 2000 });
  const target = { top: 2400, left: 200, width: 160, height: 40 };
  const frames = [list, windowPane()];

  const first = planHop(snapshot(target, frames));
  assert.ok(first.pointer.y < VIEW.height, 'the pointer has to be inside the frame');
  assert.ok(first.dy > 0, String(first.dy));

  // Once the page has moved that far, the pane is on screen and the next hop scrolls the pane.
  const moved = {
    target: { ...target, top: target.top - first.dy },
    view: VIEW,
    frames: [
      { ...list, rect: { ...list.rect, top: list.rect.top - first.dy } },
      windowPane({ scrollTop: first.dy }),
    ],
  };
  const second = planHop(moved);
  assert.ok(second.pointer.y > moved.frames[0].rect.top, 'the wheel now goes over the pane itself');
  assert.ok(second.dy > 0, String(second.dy));
});

test('the pointer stays where it is when it is already over the pane that has to move', () => {
  const target = { top: 1400, left: 200, width: 160, height: 40 };
  const cursor = { x: 640, y: 380 };
  const { pointer } = planHop(snapshot(target, [windowPane()]), { cursor });
  assert.deepEqual(pointer, cursor);
});

test('the pointer moves off a cursor standing against the edge of the pane', () => {
  const list = pane({ top: 120, height: 400 });
  const target = { top: 900, left: 200, width: 160, height: 40 };
  const { pointer } = planHop(snapshot(target, [list, windowPane()]), { cursor: { x: 5, y: 5 } });
  assert.notDeepEqual(pointer, { x: 5, y: 5 });
});

test('with the terminal panel open, nothing is scrolled to the part of the frame it covers', () => {
  const target = { top: 1400, left: 200, width: 160, height: 40 };
  const panel = 300;
  const { dy, pointer } = planHop(snapshot(target, [windowPane()]), { avoidBottom: panel });

  const landed = target.top - dy;
  assert.ok(landed + target.height < VIEW.height - panel, `landed at ${landed}, under the panel`);
  assert.ok(pointer.y < VIEW.height - panel, `pointer at ${pointer.y}, on the panel`);
});

test('the visible part of an element is what a click can aim at', () => {
  const list = pane({ top: 100, left: 100, width: 600, height: 400 });
  // Half of it is below the pane's bottom edge: 480 → 520, pane ends at 500.
  const target = { top: 480, left: 200, width: 160, height: 40 };

  const box = visibleBox(snapshot(target, [list, windowPane()]));
  assert.deepEqual(box, { x: 200, y: 480, width: 160, height: 20 });
});

test('an element scrolled out of its pane has nothing to aim at', () => {
  const list = pane({ top: 100, left: 100, width: 600, height: 400 });
  const target = { top: 900, left: 200, width: 160, height: 40 };
  assert.equal(visibleBox(snapshot(target, [list, windowPane()])), null);
});

test('an element below the frame has nothing to aim at either', () => {
  const target = { top: 1400, left: 200, width: 160, height: 40 };
  assert.equal(visibleBox(snapshot(target, [windowPane()])), null);
});

test('two rectangles that only touch do not overlap', () => {
  const a = { top: 0, left: 0, width: 100, height: 100 };
  const b = { top: 100, left: 0, width: 100, height: 100 };
  assert.equal(intersect(a, b), null);
});
