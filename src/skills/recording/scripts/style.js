// How every mark drawn on a finished take looks. Fixed on purpose, with no configuration: a
// reviewer who has seen one take has learned what a highlight, an arrow and a cover mean in all
// of them.

// The orange the runner already draws the cursor, its click ring and the terminal panel's caret
// in: everything the recording adds on top of the page is one colour, so a viewer tells the
// evidence's own marks from the application's at a glance. `cursor.js` and `terminal-panel.js`
// are injected into the page and cannot require this file; a test holds them to this value.
const ACCENT = '#C66A42';
const HALO = '#FFFFFF';

// Sizes in pixels of a 1280px-wide frame — the default viewport, and the width the marks were
// tuned at.
const BASE_WIDTH = 1280;
const SIZES = {
  // 4px still reads once the gif is shown at ~800px; thinner lines get lost, thicker ones cover
  // the edge of the text they surround.
  stroke: 4,
  // White on each side of the stroke, so the mark reads on dark and light pages alike.
  halo: 2,
  radius: 8,
  // Outside the target box, so the stroke does not sit on the element's own border or text.
  padding: 6,
  // Between the arrow's tip and the target box: touching it would cover the element's edge.
  tipGap: 4,
  arrowLength: 120,
  // The arrow to fall back on where the full length would lie across the labels around its box: in
  // a dense toolbar the only calm strip is the gap right next to the element. 60% of the full length
  // still reads as an arrow rather than a stub once the head is on, and the head keeps its size, so
  // the two lengths point the same way to the eye.
  shortArrowLength: 72,
  // The stretch of an arrow's strip its busyness is measured over: about one short word of body
  // text, so a shaft that clips a single word scores as crossing it.
  stretch: 24,
  headLength: 16,
  headWidth: 16,
  // A mosaic block taller than a line of body text (13-16px at this width) holds less than one
  // glyph, so no letter survives in it — and the block does not average two lines together into
  // something a reader could guess back from the shape of a word.
  coverBlock: 16,
};

// The busyness — mean brightness step between neighbouring pixels, in levels of 255, on the busiest
// stretch of an arrow's strip — above which the strip counts as crossing text or a control, and no
// arrow is drawn. Measured on recorded takes: a strip over white space or a panel's fill scores
// 0-4, one that crosses a thin panel border or a table rule 4-9, and one through a button label or
// a line of body text 17 and up — 33 where a shaft runs across the label of the button beside its
// target.
const CROSSING = 12;

// The join where footage was taken out plays on held frames, never moving ones, so the effect
// cannot blur a click the viewer has not finished reading. Seconds per phase.
const TRANSITION = {
  holdBefore: 0.4,
  fadeOut: 0.3,
  fadeIn: 0.3,
  holdAfter: 0.4,
  // Darkened toward this brightness, not black: the frame stays recognisable through the cut.
  brightness: 0.4,
  // Blur radius as a fraction of the frame's shorter side, so the effect looks the same at every
  // frame size: 1/50 is 16px on an 800px-tall frame — enough to wash out body text, so the eye
  // stops reading, while panels and headings keep their shape and the scene is still recognisable.
  // A fraction this small also stays far under the half-side limit boxblur enforces on every plane.
  blur: 1 / 50,
};

// A highlight or an arrow in the video draws itself rather than popping in finished, which a
// viewer looking elsewhere misses. Seconds: the outline traces round the box, and an arrow's shaft
// then grows toward it. Fast enough not to hold anything up, slow enough to pull the eye there.
// `still` is the least time a mark stays fully drawn, so a short range is lengthened to fit it.
const DRAW = {
  outline: 0.35,
  shaft: 0.25,
  still: 1,
};

// Every size for a frame of this width. Rounded to whole pixels so strokes land on the pixel grid,
// and never below 1px, where a mark would vanish on a small frame.
function scaled(frameWidth) {
  const factor = frameWidth / BASE_WIDTH;
  const sizes = Object.fromEntries(
    Object.entries(SIZES).map(([key, value]) => [key, Math.max(1, Math.round(value * factor))])
  );
  // Derived after rounding, so the white always shows the same width on both sides.
  sizes.haloWidth = sizes.stroke + 2 * sizes.halo;
  return sizes;
}

module.exports = { ACCENT, HALO, BASE_WIDTH, SIZES, CROSSING, TRANSITION, DRAW, scaled };
