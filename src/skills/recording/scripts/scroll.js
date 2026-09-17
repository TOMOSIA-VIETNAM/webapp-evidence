// Bringing an element into view the way a person does.
//
// Playwright's scrollIntoViewIfNeeded jumps: in one frame the element is below the fold, in the
// next it is on screen, and there is nothing in between. In a video that reads as a cut — and the
// cursor, which travels on a clock of its own, is then seen sliding towards a place that was
// empty a moment earlier, or off the frame entirely when the jump did not happen at all. So the
// runner turns the wheel instead, over as many frames as an eye needs to follow.
//
// What to scroll and by how much is decided here, from one measurement of the page, so that all
// of it can be tested without a browser: which pane moves, how far, where the pointer has to be
// standing for the wheel to reach that pane, and — once everything has stopped moving — how much
// of the element a viewer can actually see.

// Where in the visible area a scrolled-to element is left: slightly above the middle, which is
// where a hand stops, and far enough from the bottom edge to read what sits under it.
const FOCUS = 0.38;

// An element is left at least this far from the edge of the pane holding it. An element already
// this deep inside is not scrolled at all — nudging the page by a few pixels before every click
// is a tic, not a person.
const MARGIN = 12;

// Under this many pixels a scroll costs frames and shows nothing.
const MIN_SCROLL = 8;

// A pane smaller than this has no room for a pointer to stand in and still be clearly inside it.
const MIN_AIM = 24;

const bottomOf = (rect) => rect.top + rect.height;
const rightOf = (rect) => rect.left + rect.width;

// The part of `rect` that is inside `within`, or null when they do not meet.
function intersect(rect, within) {
  const top = Math.max(rect.top, within.top);
  const left = Math.max(rect.left, within.left);
  const height = Math.min(bottomOf(rect), bottomOf(within)) - top;
  const width = Math.min(rightOf(rect), rightOf(within)) - left;
  if (height <= 0 || width <= 0) return null;
  return { top, left, width, height };
}

// How far one axis of a pane has to scroll to put `size` pixels starting at `start` comfortably
// inside the pane, given where the pane already stands on that axis. Positive means the content
// moves up (or left): the same sign a wheel delta carries.
function shortfall({ start, size, frameStart, frameSize, scrollPos, scrollMax }) {
  if (scrollMax <= 0) return 0;               // nothing to scroll on this axis
  // Already in view: whether it sits near an edge or dead centre, moving the page under it would
  // be a tic rather than an action. The margin below decides where something out of view LANDS,
  // it does not decide what counts as out of view.
  if (start >= frameStart && start + size <= frameStart + frameSize) return 0;

  const wanted = size >= frameSize - 2 * MARGIN
    // Longer than the space it has to fit in — there is no placing it, so line its leading edge
    // up with the pane's, which is where reading it starts.
    ? start - (frameStart + MARGIN)
    : start - (frameStart + frameSize * FOCUS - size / 2);
  return Math.round(Math.max(-scrollPos, Math.min(wanted, scrollMax - scrollPos)));
}

// Where to leave the pointer while this pane scrolls. A wheel is delivered wherever the pointer
// stands, so it has to be standing inside the part of the pane a viewer can see.
function pointerFor(place, { cursor }) {
  if (place.width < MIN_AIM || place.height < MIN_AIM) return null;

  // Already standing in it: a person scrolling does not move their hand first.
  const inside = cursor
    && cursor.x >= place.left + MIN_AIM / 2 && cursor.x <= rightOf(place) - MIN_AIM / 2
    && cursor.y >= place.top + MIN_AIM / 2 && cursor.y <= bottomOf(place) - MIN_AIM / 2;
  if (inside) return { x: cursor.x, y: cursor.y };

  return { x: Math.round(place.left + place.width / 2), y: Math.round(place.top + place.height / 2) };
}

// The next single scroll to make, or null when the element is already where it can be clicked.
//
// One hop at a time, innermost pane outwards: a pane can only be scrolled while it is on screen,
// so when it is not, what holds it moves first and the pane itself waits for the next hop. That
// is also the order a person works in — scroll the page to the list, then scroll the list.
function planHop({ target, view, frames }, { cursor = null, avoidBottom = 0 } = {}) {
  // What any pane has to work with: the frame, less the terminal panel drawn over the bottom of
  // it. Scrolling something to a place the panel covers would only earn a refusal to click it.
  const room = { top: 0, left: 0, width: view.width, height: Math.max(0, view.height - avoidBottom) };

  let focus = target;
  for (const frame of frames) {
    // The part of this pane that is on screen. A pane hanging off the bottom has less usable
    // height than its own box claims, and placing anything against the box would aim at a spot
    // no one can see.
    const place = intersect(frame.rect, room);
    if (place) {
      const dy = shortfall({
        start: focus.top, size: focus.height,
        frameStart: place.top, frameSize: place.height,
        scrollPos: frame.scrollTop, scrollMax: frame.maxTop,
      });
      const dx = shortfall({
        start: focus.left, size: focus.width,
        frameStart: place.left, frameSize: place.width,
        scrollPos: frame.scrollLeft, scrollMax: frame.maxLeft,
      });

      if (Math.abs(dx) >= MIN_SCROLL || Math.abs(dy) >= MIN_SCROLL) {
        const pointer = pointerFor(place, { cursor });
        if (pointer) return { dx, dy, pointer };
      }
    }
    // Either this pane is where it should be, or it cannot be reached yet. Both leave the same
    // job for the pane outside it: put this one on screen, with the element still the thing that
    // has to end up visible.
    focus = intersect(focus, frame.rect) || frame.rect;
  }
  return null;
}

// How much of the element a viewer can see: what is left of it after every pane that clips it and
// the frame itself. Null when none of it is on screen. This is what a click aims at, so a partly
// covered element is still clicked where it can be seen rather than at a centre that is not there.
function visibleBox({ target, view, frames }) {
  let box = intersect(target, { top: 0, left: 0, width: view.width, height: view.height });
  for (const frame of frames) {
    if (!box) return null;
    box = intersect(box, frame.rect);
  }
  if (!box) return null;
  return { x: box.left, y: box.top, width: box.width, height: box.height };
}

// Measure the element and every pane between it and the window, in one round trip. Runs in the
// page, so it stands alone: nothing in this module is in scope there.
const SNAPSHOT = (el) => {
  const rectOf = (r) => ({ top: r.top, left: r.left, width: r.width, height: r.height });
  const frames = [];

  for (let node = el.parentElement; node; node = node.parentElement) {
    const style = getComputedStyle(node);
    // `hidden` and `clip` overflow can be scrolled by a script but not by a wheel, and this plan
    // is carried out with a wheel. Leaving them out is what sends those cases to the fallback.
    const scrollableY = /(auto|scroll|overlay)/.test(style.overflowY)
      && node.scrollHeight - node.clientHeight > 1;
    const scrollableX = /(auto|scroll|overlay)/.test(style.overflowX)
      && node.scrollWidth - node.clientWidth > 1;
    if (!scrollableY && !scrollableX) continue;
    frames.push({
      rect: rectOf(node.getBoundingClientRect()),
      scrollTop: node.scrollTop,
      scrollLeft: node.scrollLeft,
      maxTop: scrollableY ? node.scrollHeight - node.clientHeight : 0,
      maxLeft: scrollableX ? node.scrollWidth - node.clientWidth : 0,
    });
  }

  const doc = document.scrollingElement || document.documentElement;
  frames.push({
    rect: { top: 0, left: 0, width: window.innerWidth, height: window.innerHeight },
    scrollTop: window.scrollY,
    scrollLeft: window.scrollX,
    maxTop: Math.max(0, doc.scrollHeight - window.innerHeight),
    maxLeft: Math.max(0, doc.scrollWidth - window.innerWidth),
  });

  return { target: rectOf(el.getBoundingClientRect()), view: { width: window.innerWidth, height: window.innerHeight }, frames };
};

// Wait until the element has stopped moving. An app with `scroll-behavior: smooth` animates the
// scroll a helper asked for, so measuring right afterwards returns a position the element is
// about to leave — the cursor then travels to where it was, not to where it will be. Watching the
// element itself covers every way it can be moving, whichever pane is animating and whoever
// started it. Runs in the page; stands alone for the same reason as SNAPSHOT.
const SETTLE = (el, { stillFrames, timeoutMs }) => new Promise((resolve) => {
  // The deadline is kept on a timer rather than counted inside the frame callback: a tab the
  // browser has stopped drawing runs no frames at all, and waiting for one that never comes would
  // hold the take until Playwright gave up on it.
  const deadline = setTimeout(resolve, timeoutMs);
  const finish = () => { clearTimeout(deadline); resolve(); };

  let previous = null;
  let still = 0;
  const step = () => {
    const rect = el.getBoundingClientRect();
    if (previous && Math.abs(rect.top - previous.top) < 0.5 && Math.abs(rect.left - previous.left) < 0.5) {
      still += 1;
    } else {
      still = 0;
    }
    previous = rect;
    if (still >= stillFrames) return finish();
    requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
});

module.exports = { planHop, visibleBox, intersect, shortfall, SNAPSHOT, SETTLE, FOCUS, MARGIN, MIN_SCROLL };
