// The highlight and the arrow, drawn once as SVG and rendered by the browser for both kinds of
// output: over the PNG for a screenshot, and to a transparent PNG that ffmpeg lays over a stretch
// of video. One drawing path, so a mark on a screenshot and the same mark in the video cannot
// drift apart.
//
// `svgFor` is plain string building, testable without a browser. Coordinates are frame pixels.
const fs = require('fs');
const { execFileSync } = require('child_process');
const { chromium } = require('playwright-core');
const { ACCENT, HALO, DRAW, CROSSING, scaled } = require('./style');
const { resolveSettings } = require('./settings');

const n = (value) => Number(value.toFixed(2));

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

// The rectangle sits outside the box by the padding, but is pulled in at a frame edge: an element
// flush against the edge would otherwise lose that side of its outline, halo included.
function ring(box, frame, s) {
  const inset = s.haloWidth / 2;
  const x0 = Math.max(inset, box.x - s.padding);
  const y0 = Math.max(inset, box.y - s.padding);
  const x1 = Math.min(frame.width - inset, box.x + box.width + s.padding);
  const y1 = Math.min(frame.height - inset, box.y + box.height + s.padding);
  return { x0, y0, x1, y1 };
}

// How much of a stroke to show while it traces itself: the outline measured as 100 whatever its
// real length, one dash that long, slid back by the part not drawn yet. Halo and accent share it,
// so the two trace round the box together. Finished, the stroke is plain.
const DASH = 100;
const traced = (progress) => (progress >= 1 ? '' :
  ` pathLength="${DASH}" stroke-dasharray="${DASH} ${DASH}" stroke-dashoffset="${n(DASH * (1 - progress))}"`);

function highlight(box, frame, s, progress) {
  const { x0, y0, x1, y1 } = ring(box, frame, s);
  const rect = (colour, width) =>
    `<rect x="${n(x0)}" y="${n(y0)}" width="${n(x1 - x0)}" height="${n(y1 - y0)}" ` +
    `rx="${s.radius}" fill="none" stroke="${colour}" stroke-width="${width}"${traced(progress)}/>`;
  return rect(HALO, s.haloWidth) + rect(ACCENT, s.stroke);
}

// Where an arrow can come from, in the order it is preferred when the picture gives no reason to
// choose: right of the box first, where an arrow reads like an annotation; then left, below, above;
// then the four diagonals, the right-hand ones first. `dir` is the unit direction from tip to tail.
const D = Math.SQRT1_2;
const SIDES = [
  ['right', [1, 0]], ['left', [-1, 0]], ['below', [0, 1]], ['above', [0, -1]],
  ['above-right', [D, -D]], ['below-right', [D, D]], ['above-left', [-D, -D]], ['below-left', [-D, D]],
];

// Every arrow the box could get — each side at the full length, then each side again at the short
// one — with its points and whether all of it — tail, cap, head and their halo — lies inside the
// frame. Straight sides aim at the middle of the ring's edge; a diagonal aims at the centre of the
// ring's rounded corner, so its tip keeps the same gap from the curve as a straight arrow keeps
// from an edge.
function arrowCandidates(box, frame, s) {
  const { x0, y0, x1, y1 } = ring(box, frame, s);
  const outer = s.haloWidth / 2;
  // The head is the widest part across the arrow, so it decides how close to an edge the shaft
  // can run.
  const edge = s.headWidth / 2 + s.halo;
  const cx = clamp((x0 + x1) / 2, edge, frame.width - edge);
  const cy = clamp((y0 + y1) / 2, edge, frame.height - edge);
  // The browser shrinks a corner radius that does not fit the rectangle, so the arc is measured the
  // same way.
  const r = Math.min(s.radius, (x1 - x0) / 2, (y1 - y0) / 2);
  const reach = r + outer + s.tipGap;
  const inside = ([x, y], margin) => (
    x - margin >= 0 && x + margin <= frame.width && y - margin >= 0 && y + margin <= frame.height
  );
  return [s.arrowLength, s.shortArrowLength].flatMap((length) => SIDES.map(([side, [dx, dy]]) => {
    let tip;
    if (dx && dy) {
      tip = [(dx > 0 ? x1 - r : x0 + r) + dx * reach, (dy > 0 ? y1 - r : y0 + r) + dy * reach];
    } else if (dx) {
      tip = [(dx > 0 ? x1 + outer : x0 - outer) + dx * s.tipGap, cy];
    } else {
      tip = [cx, (dy > 0 ? y1 + outer : y0 - outer) + dy * s.tipGap];
    }
    const tail = [tip[0] + dx * length, tip[1] + dy * length];
    const base = [tip[0] + dx * s.headLength, tip[1] + dy * s.headLength];
    // Perpendicular to the shaft, for the two back corners of the head.
    const half = s.headWidth / 2;
    const corners = [
      [base[0] - dy * half, base[1] + dx * half],
      [base[0] + dy * half, base[1] - dx * half],
    ];
    const fits = inside(tail, outer) && [tip, ...corners].every((point) => inside(point, s.halo));
    return { side, length, dir: [dx, dy], tip, tail, base, corners, fits };
  }));
}

// How busy the picture is under the strip an arrow would cover, where it is busiest: the strip is
// cut into stretches of `s.stretch` along the shaft, each scored by the mean step in brightness
// between neighbouring pixels within the head's half-width of the line from tail to tip, plus the
// padding a highlight keeps from its box, and the busiest stretch is the score. Text and borders
// are steep steps; a page's background, a panel's fill and an empty margin are none. A mean over
// the whole strip would let a long arrow that clips one word and then runs over white space pass as
// calm, and that one word under the shaft is what makes the frame look broken.
//
// The box's own ring is left out: the highlight is drawn there anyway, and the element's edge just
// inside it would make every strip look busy at its tip.
function busyness({ tail, tip }, s, luma, around) {
  const { width, height, data } = luma;
  const reach = s.headWidth / 2 + s.halo + s.padding;
  const [ax, ay] = tail;
  const [vx, vy] = [tip[0] - ax, tip[1] - ay];
  const lengthSquared = vx * vx + vy * vy;
  // Half-stretches, scored in overlapping pairs: a word that straddles two of them still fills one
  // stretch rather than being split in half between two.
  const halves = Math.max(2, Math.ceil(Math.sqrt(lengthSquared) / (s.stretch / 2)));
  const sums = new Array(halves).fill(0);
  const counts = new Array(halves).fill(0);
  // One short of the last row and column, which have no neighbour to step to.
  const span = (a, b, size) => [Math.max(0, Math.floor(Math.min(a, b) - reach)), Math.min(size - 2, Math.ceil(Math.max(a, b) + reach))];
  const xs = span(ax, tip[0], width);
  const ys = span(ay, tip[1], height);
  for (let y = ys[0]; y <= ys[1]; y++) {
    for (let x = xs[0]; x <= xs[1]; x++) {
      if (around && x >= around.x0 && x <= around.x1 && y >= around.y0 && y <= around.y1) continue;
      const along = clamp(((x - ax) * vx + (y - ay) * vy) / lengthSquared, 0, 1);
      if (Math.hypot(x - (ax + along * vx), y - (ay + along * vy)) > reach) continue;
      const i = y * width + x;
      const half = Math.min(halves - 1, Math.floor(along * halves));
      sums[half] += Math.abs(data[i + 1] - data[i]) + Math.abs(data[i + width] - data[i]);
      counts[half] += 1;
    }
  }
  let busiest = 0;
  for (let k = 0; k + 1 < halves; k++) {
    const count = counts[k] + counts[k + 1];
    if (count) busiest = Math.max(busiest, (sums[k] + sums[k + 1]) / count);
  }
  return busiest;
}

// Two strips this close in busyness (brightness levels per pixel) look the same to a viewer: the
// preferred arrow keeps it, so a plain page still gets the full-length arrow from the right, and
// the short one is only drawn where every full-length strip is busier than it by more than this.
const CALM_ENOUGH = 2;

// The arrow for a box, on the picture it will be drawn over: of the arrows that fit in the frame,
// the one whose strip covers the least detail, so its shaft does not lie across the labels of the
// buttons next to the one it points at. `luma` is the frame as `{ width, height, data }`, one byte
// of brightness per pixel; without it, the first arrow that fits in the preferred order.
//
// Null when even the calmest strip crosses something — busier than CROSSING somewhere along it.
// The highlight alone already says where to look, and a shaft through a neighbouring label makes
// the frame look broken.
function chooseArrow({ box, frame, s, luma }) {
  const fitting = arrowCandidates(box, frame, s).filter((c) => c.fits);
  if (!fitting.length) {
    throw new Error(
      `No side of the box ${JSON.stringify(box)} leaves room for a ${s.shortArrowLength}px arrow inside ` +
      `the ${frame.width}x${frame.height} frame. Use a highlight for an element this large.`
    );
  }
  if (!luma) return fitting[0];
  if (luma.width !== frame.width || luma.height !== frame.height) {
    throw new Error(`The picture is ${luma.width}x${luma.height}, the frame ${frame.width}x${frame.height}.`);
  }
  const { x0, y0, x1, y1 } = ring(box, frame, s);
  const outer = s.haloWidth / 2;
  const around = { x0: x0 - outer, y0: y0 - outer, x1: x1 + outer, y1: y1 + outer };
  const scores = fitting.map((c) => busyness(c, s, luma, around));
  const calmest = Math.min(...scores);
  if (calmest > CROSSING) return null;
  return fitting[scores.findIndex((score) => score <= calmest + CALM_ENOUGH)];
}

// An arrow always comes with the highlight it points at. Drawn on its own, its tip would land on
// the element's bare edge while a highlight of the same element sits a padding further out, and
// the two read as pointing at different things. So the tip aims at the outside of the ring, halo
// included.
//
// `side` and `length` are the ones chooseArrow picked, passed in so every frame of a mark drawing
// itself uses the one decision; a side with no length is the full-length arrow. Without a side the
// arrow is chosen here, on `luma` if there is one — and where every path crosses something, only
// the highlight is drawn.
//
// Drawing itself, the highlight traces first over its share of the time, then the shaft grows from
// the tail toward the box, and the head lands only once the shaft has arrived: a head travelling
// with a growing shaft would point at the element before the line had reached it.
function arrow(box, frame, s, progress, { side, length = s.arrowLength, luma }) {
  if (!side) {
    const picked = chooseArrow({ box, frame, s, luma });
    if (!picked) return highlight(box, frame, s, progress);
    ({ side, length } = picked);
  }
  const chosen = arrowCandidates(box, frame, s).find((c) => c.side === side && c.length === length);
  if (!chosen) throw new Error(`Unknown arrow side "${side}". Known: ${SIDES.map(([name]) => name).join(', ')}`);
  const { tip, tail, base, corners } = chosen;
  const points = [tip, ...corners].map(([x, y]) => `${n(x)},${n(y)}`).join(' ');
  const share = DRAW.outline / (DRAW.outline + DRAW.shaft);
  const grown = clamp((progress - share) / (1 - share), 0, 1);
  const outline = highlight(box, frame, s, Math.min(1, progress / share));
  if (grown === 0) return outline;
  // The shaft stops at the head's base: carried on to the tip, its round cap would blunt the point.
  const end = [tail[0] + (base[0] - tail[0]) * grown, tail[1] + (base[1] - tail[1]) * grown];
  const line = (colour, width) =>
    `<line x1="${n(tail[0])}" y1="${n(tail[1])}" x2="${n(end[0])}" y2="${n(end[1])}" ` +
    `stroke="${colour}" stroke-width="${width}" stroke-linecap="round"/>`;
  if (progress < 1) return outline + line(HALO, s.haloWidth) + line(ACCENT, s.stroke);
  // A stroke is centred on the outline, so twice the halo leaves exactly the halo outside it.
  return outline + line(HALO, s.haloWidth) +
    `<polygon points="${points}" fill="${HALO}" stroke="${HALO}" stroke-width="${2 * s.halo}" ` +
    'stroke-linejoin="round"/>' +
    line(ACCENT, s.stroke) +
    `<polygon points="${points}" fill="${ACCENT}"/>`;
}

const MARKS = { highlight, arrow };

// A whole SVG document the size of the frame, so it lays over the frame with no offset to apply.
// `progress` runs from 0 to 1 while a mark in the video draws itself; a screenshot has no time
// and gets the finished mark. An arrow takes the `side` and `length` chooseArrow picked, or the
// `luma` of the picture to pick one on.
function svgFor({ kind, box, frame, progress = 1, side, length, luma }) {
  const draw = MARKS[kind];
  if (!draw) throw new Error(`Unknown mark "${kind}". Known: ${Object.keys(MARKS).join(', ')}`);
  const drawn = draw(box, frame, scaled(frame.width), clamp(progress, 0, 1), { side, length, luma });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${frame.width}" height="${frame.height}" ` +
    `viewBox="0 0 ${frame.width} ${frame.height}">${drawn}</svg>`;
}

// Width and height from the PNG header, so the page is sized to the image without decoding it.
function pngSize(file) {
  const head = Buffer.alloc(24);
  const fd = fs.openSync(file, 'r');
  try { fs.readSync(fd, head, 0, 24, 0); } finally { fs.closeSync(fd); }
  if (head.toString('ascii', 12, 16) !== 'IHDR') throw new Error(`${file} is not a PNG`);
  return { width: head.readUInt32BE(16), height: head.readUInt32BE(20) };
}

// deviceScaleFactor 1 keeps one CSS pixel to one image pixel: on a Retina default the screenshot
// would come out at twice the frame size and no longer lay over the video. Every image goes
// through one browser: a mark drawing itself is a dozen frames or more, and a launch for each
// would cost more than all of them together.
async function screenshots(size, shots, omitBackground) {
  // The same channel record.js launches, environment override included.
  const { browserChannel } = resolveSettings({}).recording;
  const browser = await chromium.launch({ channel: browserChannel });
  try {
    const page = await browser.newPage({ viewport: size, deviceScaleFactor: 1 });
    for (const { body, path: outPath } of shots) {
      await page.setContent(
        '<style>html,body{margin:0;background:transparent}' +
        'body>*{position:absolute;left:0;top:0;display:block}</style>' + body
      );
      await page.screenshot({ path: outPath, omitBackground });
    }
  } finally {
    await browser.close();
  }
}

// The brightness of every pixel of the frames ffmpeg decodes from `input` (its arguments up to the
// output), one byte each, for chooseArrow to read the picture an arrow lands on. ffmpeg decodes
// both a video and a PNG, so the two kinds of output are read the same way.
function lumaFrames(input, frame) {
  const size = frame.width * frame.height;
  const raw = execFileSync('ffmpeg', ['-v', 'error', ...input, '-f', 'rawvideo', '-pix_fmt', 'gray', 'pipe:1'],
    { maxBuffer: 64 * size + 1024 * 1024 });
  return Array.from({ length: Math.floor(raw.length / size) }, (_, i) => (
    { width: frame.width, height: frame.height, data: raw.subarray(i * size, (i + 1) * size) }
  ));
}

// `marks` is [{ kind, box }], drawn finished over the screenshot, each arrow chosen on the
// screenshot itself. Returns the marks as drawn: an arrow with its side and length, or turned into
// a highlight where every path to its box crosses something.
async function renderOver(pngPath, marks, outPath) {
  const frame = pngSize(pngPath);
  const [luma] = lumaFrames(['-i', pngPath], frame);
  const s = scaled(frame.width);
  const drawn = marks.map((mark) => {
    if (mark.kind !== 'arrow') return mark;
    const chosen = chooseArrow({ box: mark.box, frame, s, luma });
    return chosen ? { ...mark, side: chosen.side, length: chosen.length } : { ...mark, kind: 'highlight' };
  });
  const svgs = drawn.map(({ kind, box, side, length }) => svgFor({ kind, box, frame, side, length }));
  const image = `<img src="data:image/png;base64,${fs.readFileSync(pngPath).toString('base64')}">`;
  await screenshots(frame, [{ body: image + svgs.join(''), path: outPath }], false);
  return drawn;
}

// `images` is [{ svg, path }], each written as a transparent PNG of the frame size.
async function renderTransparent(images, frame) {
  await screenshots(
    { width: frame.width, height: frame.height },
    images.map(({ svg, path: outPath }) => ({ body: svg, path: outPath })),
    true
  );
}

module.exports = {
  svgFor, chooseArrow, arrowCandidates, busyness, lumaFrames, renderOver, renderTransparent, pngSize,
};
