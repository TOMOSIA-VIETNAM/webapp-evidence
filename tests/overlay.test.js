// The marks drawn on a finished take, read back from the SVG markup. No browser: what can go wrong
// silently here is geometry — a stroke that does not scale, an arrow whose tail leaves the frame —
// and all of it is in the numbers.
const fs = require('fs');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');
const { svgFor, chooseArrow, arrowCandidates, busyness } = require('../src/skills/recording/scripts/overlay');
const { ACCENT, CROSSING, scaled, TRANSITION } = require('../src/skills/recording/scripts/style');

const frame = { width: 1280, height: 800 };

const attrs = (svg, tag) => [...svg.matchAll(new RegExp(`<${tag} ([^>]*)/>`, 'g'))]
  .map(([, body]) => Object.fromEntries([...body.matchAll(/([\w-]+)="([^"]*)"/g)].map(([, k, v]) => [k, v])));

// The accent shaft of an arrow: the last line drawn, so it sits over the halo.
const shaft = (svg) => {
  const line = attrs(svg, 'line').at(-1);
  return { x1: +line.x1, y1: +line.y1, x2: +line.x2, y2: +line.y2 };
};
const tip = (svg) => attrs(svg, 'polygon').at(-1).points.split(' ')[0].split(',').map(Number);

test('the marks are drawn in the colour of the cursor and the terminal caret', () => {
  const [r, g, b] = ACCENT.match(/\w\w/g).map((h) => parseInt(h, 16));
  for (const file of ['cursor.js', 'terminal-panel.js']) {
    const source = fs.readFileSync(path.join(__dirname, '../src/skills/recording/scripts', file), 'utf8');
    assert.ok(source.toLowerCase().includes(ACCENT.toLowerCase()) || source.includes(`rgba(${r}, ${g}, ${b},`),
      `${file} no longer draws in ${ACCENT}`);
  }
});

test('sizes are for a 1280px frame and scale with its width', () => {
  assert.deepEqual(
    [scaled(1280).stroke, scaled(1280).haloWidth, scaled(1280).padding, scaled(1280).radius],
    [4, 8, 6, 8]
  );
  assert.deepEqual([scaled(1920).stroke, scaled(1920).haloWidth, scaled(1920).padding], [6, 12, 9]);
});

test('no size drops below one pixel on a tiny frame', () => {
  for (const value of Object.values(scaled(100))) assert.ok(value >= 1);
});

test('the transition holds, fades and darkens to the fixed lengths', () => {
  const { holdBefore, fadeOut, fadeIn, holdAfter, brightness } = TRANSITION;
  assert.equal(Number((holdBefore + fadeOut + fadeIn + holdAfter).toFixed(3)), 1.4);
  assert.equal(brightness, 0.4);
});

test('a highlight is a rounded accent rectangle over a wider white one, padded outside the box', () => {
  const svg = svgFor({ kind: 'highlight', box: { x: 100, y: 200, width: 80, height: 30 }, frame });
  assert.match(svg, /^<svg [^>]*width="1280" height="800"/);
  const [halo, accent] = attrs(svg, 'rect');
  assert.equal(accent.stroke, ACCENT);
  assert.equal(halo.stroke.toUpperCase(), '#FFFFFF');
  assert.deepEqual([halo['stroke-width'], accent['stroke-width']], ['8', '4']);
  assert.deepEqual([accent.x, accent.y, accent.width, accent.height, accent.rx], ['94', '194', '92', '42', '8']);
});

test('on a 1920px frame the strokes and the padding grow with it', () => {
  const svg = svgFor({ kind: 'highlight', box: { x: 100, y: 200, width: 80, height: 30 }, frame: { width: 1920, height: 1080 } });
  const [halo, accent] = attrs(svg, 'rect');
  assert.deepEqual([halo['stroke-width'], accent['stroke-width'], accent.x], ['12', '6', '91']);
});

// The ring of an arrow's highlight ends at the box plus the padding (6) plus half the halo stroke
// (4); the tip stops 4px beyond that.
test('an arrow brings the highlight of its box and points at the outside of that ring', () => {
  const box = { x: 100, y: 200, width: 80, height: 30 };
  const svg = svgFor({ kind: 'arrow', box, frame });
  const [, accent] = attrs(svg, 'rect');
  assert.deepEqual([accent.x, accent.width], ['94', '92']);
  assert.deepEqual(tip(svg), [194, 215]);
  assert.ok(shaft(svg).x1 > 194);
  assert.equal(attrs(svg, 'polygon').at(-1).fill, ACCENT);
});

test('at the right edge of the frame the arrow comes from the left', () => {
  const box = { x: 1200, y: 400, width: 70, height: 30 };
  const svg = svgFor({ kind: 'arrow', box, frame });
  assert.deepEqual(tip(svg), [1186, 415]);
  assert.ok(shaft(svg).x1 < 1186);
});

test('a box spanning the width gets its arrow from below, or above at the bottom', () => {
  const wide = { x: 20, y: 100, width: 1240, height: 40 };
  assert.deepEqual(tip(svgFor({ kind: 'arrow', box: wide, frame })), [640, 154]);
  const bottom = { ...wide, y: 740 };
  assert.deepEqual(tip(svgFor({ kind: 'arrow', box: bottom, frame })), [640, 726]);
});

test('in a corner the whole arrow, halo and head included, stays inside the frame', () => {
  const s = scaled(frame.width);
  for (const box of [
    { x: 1230, y: 0, width: 50, height: 6 },
    { x: 0, y: 790, width: 60, height: 10 },
  ]) {
    const svg = svgFor({ kind: 'arrow', box, frame });
    const { x1, y1 } = shaft(svg);
    assert.ok(x1 - s.haloWidth / 2 >= 0 && x1 + s.haloWidth / 2 <= frame.width, `tail x ${x1}`);
    for (const point of attrs(svg, 'polygon').at(-1).points.split(' ')) {
      const [x, y] = point.split(',').map(Number);
      assert.ok(x - s.halo >= 0 && x + s.halo <= frame.width && y - s.halo >= 0 && y + s.halo <= frame.height,
        `head point ${point}`);
    }
    assert.ok(y1 >= 0 && y1 <= frame.height);
  }
});

test('a box with no room on any side is refused rather than drawn off the frame', () => {
  assert.throws(() => svgFor({ kind: 'arrow', box: { x: 10, y: 10, width: 1260, height: 780 }, frame }));
});

// ---------- choosing the arrow on the picture ----------

// A grey picture of the frame, `busy(x, y)` marking the pixels that carry detail: alternating black
// and white columns there, as a line of text is to the eye.
const picture = (busy = () => false) => {
  const data = new Uint8Array(frame.width * frame.height).fill(128);
  for (let y = 0; y < frame.height; y++) {
    for (let x = 0; x < frame.width; x++) if (busy(x, y)) data[y * frame.width + x] = x % 2 ? 255 : 0;
  }
  return { width: frame.width, height: frame.height, data };
};
const s = scaled(frame.width);
const SEARCH = { x: 400, y: 300, width: 80, height: 30 };

test('on a plain picture the arrow keeps coming from the right', () => {
  assert.equal(chooseArrow({ box: SEARCH, frame, s, luma: picture() }).side, 'right');
  assert.equal(chooseArrow({ box: SEARCH, frame, s }).side, 'right');
});

test('a row of labels to the right of the box sends the arrow round them', () => {
  // The buttons next to the target, level with it, as on a toolbar
  const luma = picture((x, y) => x > SEARCH.x + SEARCH.width && y >= SEARCH.y - 10 && y <= SEARCH.y + SEARCH.height + 10);
  const chosen = chooseArrow({ box: SEARCH, frame, s, luma });
  assert.equal(chosen.side, 'left');
  // With the rows above and below busy too, only a diagonal on the right-hand side, or the left, is
  // calm. The neighbours' labels sit inside their buttons, a button's padding away from the box.
  const label = (x) => x < SEARCH.x - 30 || x > SEARCH.x + SEARCH.width + 30;
  const toolbar = picture((x, y) => x > SEARCH.x - 200 && label(x) && y >= SEARCH.y && y <= SEARCH.y + SEARCH.height
    || (y < SEARCH.y - 10 || y > SEARCH.y + SEARCH.height + 10) && Math.abs(x - (SEARCH.x + SEARCH.width / 2)) < 30);
  assert.equal(chooseArrow({ box: SEARCH, frame, s, luma: toolbar }).side, 'above-right');
});

test('whichever arrow wins, all of it stays inside the frame for a box in a corner', () => {
  const inside = ([x, y], margin) => x - margin >= 0 && x + margin <= frame.width && y - margin >= 0 && y + margin <= frame.height;
  for (const box of [{ x: 1230, y: 0, width: 50, height: 6 }, { x: 0, y: 770, width: 60, height: 30 }]) {
    // Every arrow the picture could pick, not only the one a plain picture picks
    for (const chosen of arrowCandidates(box, frame, s).filter((c) => c.fits)) {
      assert.ok(inside(chosen.tail, s.haloWidth / 2), `${chosen.side} tail ${chosen.tail}`);
      for (const point of [chosen.tip, ...chosen.corners]) assert.ok(inside(point, s.halo), `${chosen.side} ${point}`);
    }
  }
});

// ---------- an arrow that would cross something ----------

// Text-like detail at a contrast a page really has: dark grey strokes two pixels wide on white
const page = (busy) => {
  const data = new Uint8Array(frame.width * frame.height).fill(255);
  for (let y = 0; y < frame.height; y++) {
    for (let x = 0; x < frame.width; x++) if (busy(x, y) && x % 4 < 2) data[y * frame.width + x] = 90;
  }
  return { width: frame.width, height: frame.height, data };
};

test('a long strip that clips one short word counts as crossing it; a clean strip does not', () => {
  const right = arrowCandidates(SEARCH, frame, s).find((c) => c.side === 'right' && c.length === s.arrowLength);
  // One word, 20px of text, near the tail; the rest of the strip is white
  const tailX = right.tail[0];
  const word = page((x, y) => x > tailX - 30 && x < tailX - 10 && Math.abs(y - right.tail[1]) < 6);
  assert.ok(busyness(right, s, word) > CROSSING);
  assert.ok(busyness(right, s, page(() => false)) <= CROSSING);
});

test('where every path crosses something, no arrow is chosen and the mark is the highlight alone', () => {
  const crowded = page(() => true);
  assert.equal(chooseArrow({ box: SEARCH, frame, s, luma: crowded }), null);
  const svg = svgFor({ kind: 'arrow', box: SEARCH, frame, luma: crowded });
  assert.equal(svg, svgFor({ kind: 'highlight', box: SEARCH, frame }));
  assert.doesNotMatch(svg, /<line|<polygon/);
});

test('a diagonal arrow points at the rounded corner of the ring from outside it', () => {
  const svg = svgFor({ kind: 'arrow', box: SEARCH, frame, side: 'below-right' });
  const [, accent] = attrs(svg, 'rect');
  // Centre of the ring's lower-right arc: the ring's corner, one radius in on both axes
  const centre = [+accent.x + +accent.width - s.radius, +accent.y + +accent.height - s.radius];
  const [tx, ty] = tip(svg);
  assert.ok(Math.abs(Math.hypot(tx - centre[0], ty - centre[1]) - (s.radius + s.haloWidth / 2 + s.tipGap)) < 0.02);
  assert.ok(Math.abs((tx - centre[0]) - (ty - centre[1])) < 0.02, 'tip on the 45° line through the arc');
  // The shaft runs away from the box at 45°, and the head's corners sit behind the tip, either side
  const { x1, y1 } = shaft(svg);
  assert.ok(Math.abs((x1 - tx) - (y1 - ty)) < 0.02 && x1 > tx);
  assert.ok(Math.abs(Math.hypot(x1 - tx, y1 - ty) - s.arrowLength) < 0.02);
  const [, left, right] = attrs(svg, 'polygon').at(-1).points.split(' ').map((p) => p.split(',').map(Number));
  const mid = [(left[0] + right[0]) / 2, (left[1] + right[1]) / 2];
  assert.ok(Math.abs(Math.hypot(mid[0] - tx, mid[1] - ty) - s.headLength) < 0.02);
  assert.ok(Math.abs(Math.hypot(left[0] - right[0], left[1] - right[1]) - s.headWidth) < 0.02);
});

test('an arrow told its side draws that side, so every frame of a drawing agrees', () => {
  const luma = picture((x) => x > SEARCH.x + SEARCH.width);
  const side = chooseArrow({ box: SEARCH, frame, s, luma }).side;
  assert.equal(svgFor({ kind: 'arrow', box: SEARCH, frame, side }), svgFor({ kind: 'arrow', box: SEARCH, frame, luma }));
  assert.throws(() => svgFor({ kind: 'arrow', box: SEARCH, frame, side: 'sideways' }), /Unknown arrow side/);
});

test('where the only calm strip is the gap next to the box, the arrow shortens to fit it', () => {
  // Busy everywhere but a band hugging the box, as in a dense toolbar: room for the short arrow on
  // every side, for the full one on none
  const near = s.padding + s.haloWidth + s.tipGap + s.shortArrowLength + s.halo;
  const calm = (x, y) => x > SEARCH.x - near && x < SEARCH.x + SEARCH.width + near
    && y > SEARCH.y - near && y < SEARCH.y + SEARCH.height + near;
  const chosen = chooseArrow({ box: SEARCH, frame, s, luma: picture((x, y) => !calm(x, y)) });
  assert.equal(chosen.length, s.shortArrowLength);
  // The head keeps its size: only the shaft is shorter
  assert.ok(Math.abs(Math.hypot(chosen.base[0] - chosen.tip[0], chosen.base[1] - chosen.tip[1]) - s.headLength) < 0.02);
  const svg = svgFor({ kind: 'arrow', box: SEARCH, frame, side: chosen.side, length: chosen.length });
  const { x1, y1 } = shaft(svg);
  assert.ok(Math.abs(Math.hypot(x1 - chosen.tip[0], y1 - chosen.tip[1]) - s.shortArrowLength) < 0.02);
  // On a plain picture the full length still wins
  assert.equal(chooseArrow({ box: SEARCH, frame, s, luma: picture() }).length, s.arrowLength);
});
