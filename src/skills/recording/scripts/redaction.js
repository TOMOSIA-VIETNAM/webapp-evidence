// Keeping things out of the finished video that were on screen while it was recorded.
//
// Everything here is arithmetic and ffmpeg argument strings, so it is testable without a video,
// a browser or a screen. The step script says which stretch of the take to treat and how; this
// turns that into a filter graph, and — for a stretch that is removed outright — into the new
// timestamps the runbook has to use.

// The radius has to clear the height of a line of text, and boxblur rejects anything from half
// the region's shorter side upwards. A field holding a token is typically wide and short, so a
// radius derived from the shorter side alone comes out too small to destroy the glyphs — hence
// the ceiling rather than a ratio, with the region's own limit only as a floor to stay legal.
// The chroma planes are half-resolution in yuv420p, and boxblur rejects a radius from half the
// plane's shorter side upwards — so a radius that is legal on luma is rejected on chroma, and
// leaving chroma to default to the luma value fails the encode outright. Both are stated.
const BLUR = [
  "boxblur=luma_radius='min(min(w,h)/2-1,20)':luma_power=4",
  "chroma_radius='min(min(cw,ch)/2-1,20)':chroma_power=4",
].join(':');

const seconds = (value) => Number(value.toFixed(3));

// ffmpeg's enable expression works on the timeline of the encoded output, and the encode seeks
// past the page-load wait first, so everything here is rebased on that same point.
const rebase = (at, trimAt) => Math.max(0, at - trimAt);

function createRedactions() {
  const entries = [];
  return {
    // `box` is null for a whole frame. `to` is filled in when the stretch ends, so an entry with
    // no end never reaches the encode: a step script that threw halfway should not silently blur
    // the rest of the take.
    open({ mode, box }) {
      const entry = { mode, box, from: null, to: null };
      entries.push(entry);
      return entry;
    },
    all: () => entries.filter((e) => e.from !== null && e.to !== null && e.to > e.from),
  };
}

// Two boxes for the same region, measured at either end of the stretch: an element that moved
// while it was showing would otherwise be covered where it used to be.
function unionBox(a, b) {
  if (!a) return b;
  if (!b) return a;
  const left = Math.min(a.x, b.x);
  const top = Math.min(a.y, b.y);
  return {
    x: left,
    y: top,
    width: Math.max(a.x + a.width, b.x + b.width) - left,
    height: Math.max(a.y + a.height, b.y + b.height) - top,
  };
}

// A little wider than the element. Text is antialiased against its background, and a box drawn on
// the exact bounds leaves a readable fringe.
function padBox(box, padding, frame) {
  const x = Math.max(0, Math.round(box.x - padding));
  const y = Math.max(0, Math.round(box.y - padding));
  return {
    x,
    y,
    width: Math.min(frame.width - x, Math.round(box.width + padding * 2)),
    height: Math.min(frame.height - y, Math.round(box.height + padding * 2)),
  };
}

// The graph that covers what has to be covered. One `-filter_complex` for every mode, rather than
// a simple `-vf` for some and a graph for others: blurring a *region* needs the frame split, the
// region cropped out, blurred and laid back on top, and one code path is worth more than the few
// characters a special case would save.
function buildFilter(redactions, trimAt) {
  const covers = redactions.filter((r) => r.mode === 'blur' || r.mode === 'box');
  const cuts = redactions.filter((r) => r.mode === 'cut');
  if (!covers.length && !cuts.length) return null;

  const steps = [];
  let label = '0:v';
  let next = 0;
  const take = () => `v${next++}`;

  for (const cover of covers) {
    const from = seconds(rebase(cover.from, trimAt));
    const to = seconds(rebase(cover.to, trimAt));
    const enable = `enable='between(t,${from},${to})'`;
    const out = take();

    if (cover.mode === 'box') {
      const area = cover.box
        ? `x=${cover.box.x}:y=${cover.box.y}:w=${cover.box.width}:h=${cover.box.height}`
        : 'x=0:y=0:w=iw:h=ih';
      steps.push(`[${label}]drawbox=${area}:color=black@1:t=fill:${enable}[${out}]`);
    } else if (!cover.box) {
      // A whole-frame blur needs no crop, and boxblur understands the timeline on its own
      steps.push(`[${label}]${BLUR}:${enable}[${out}]`);
    } else {
      const { x, y, width, height } = cover.box;
      const base = take();
      const source = take();
      const blurred = take();
      steps.push(`[${label}]split=2[${base}][${source}]`);
      steps.push(`[${source}]crop=${width}:${height}:${x}:${y},${BLUR}[${blurred}]`);
      steps.push(`[${base}][${blurred}]overlay=${x}:${y}:${enable}[${out}]`);
    }
    label = out;
  }

  // Removing stretches comes last, so a region is still covered in whatever is kept around it
  const removed = mergeRanges(cuts.map((c) => ({
    from: rebase(c.from, trimAt), to: rebase(c.to, trimAt),
  })));
  if (removed.length) {
    const kept = keptSegments(removed);
    // Each kept segment reads the same stream, and a filter graph lets a pad be consumed once,
    // so it has to be split as many ways as there are segments before any of them is trimmed.
    const sources = kept.map(() => take());
    steps.push(`[${label}]split=${sources.length}${sources.map((s) => `[${s}]`).join('')}`);
    const parts = kept.map((segment, index) => {
      const out = take();
      const end = segment.end === Infinity ? '' : `:end=${seconds(segment.end)}`;
      steps.push(`[${sources[index]}]trim=start=${seconds(segment.start)}${end},setpts=PTS-STARTPTS[${out}]`);
      return out;
    });
    const out = take();
    steps.push(`${parts.map((p) => `[${p}]`).join('')}concat=n=${parts.length}:v=1:a=0[${out}]`);
    label = out;
  }

  return { graph: steps.join(';'), label, removed };
}

// Overlapping or touching cuts have to become one range before anything counts their duration,
// or the same second is subtracted from the timeline twice.
function mergeRanges(ranges) {
  const sorted = [...ranges].sort((a, b) => a.from - b.from);
  const merged = [];
  for (const range of sorted) {
    const last = merged[merged.length - 1];
    if (last && range.from <= last.to) last.to = Math.max(last.to, range.to);
    else merged.push({ ...range });
  }
  return merged;
}

// What is left once the removed ranges are taken out. The final segment has no end: the encode
// runs to wherever the source finishes, so a take whose last stretch was cut needs no duration
// passed in and cannot be truncated by one that was measured slightly short.
function keptSegments(removed) {
  const segments = [];
  let cursor = 0;
  for (const range of removed) {
    if (range.from > cursor) segments.push({ start: cursor, end: range.from });
    cursor = Math.max(cursor, range.to);
  }
  segments.push({ start: cursor, end: Infinity });
  return segments.filter((s) => s.end === Infinity || s.end - s.start > 0.04);
}

// Where a moment of the original take ends up once stretches have been removed. Returns null for
// a moment inside one: the runbook drops that row rather than pointing at a second the viewer
// will find something else at.
function shiftTime(at, removed) {
  let shifted = at;
  for (const range of removed) {
    if (at >= range.from && at < range.to) return null;
    if (at >= range.to) shifted -= range.to - range.from;
  }
  return Math.max(0, shifted);
}

module.exports = {
  createRedactions, buildFilter, shiftTime, unionBox, padBox, mergeRanges, keptSegments, BLUR,
};
