// Taking stretches out of a take and joining what is left: the runner cuts the file picker while
// it opens on the wrong folder, and `edit.js` cuts whatever the user asks for afterwards. Both
// join the kept stretches the same way, and both move every timestamp with the same functions.
//
// Everything here is arithmetic and ffmpeg argument strings, so it is testable without a video,
// a browser or a screen.

const { TRANSITION } = require('./style');

// What a frame held at a join fades toward: blurred and darkened, but still the same scene. The
// radius scales with the frame. The chroma planes are half-resolution in yuv420p and boxblur
// rejects a radius from half a plane's shorter side upwards, so chroma states a radius of its own
// on its own planes: left to default to the luma value, it fails the encode. Darkening scales every
// RGB channel by the same factor, which in limited-range YUV is luma toward black (16) and chroma
// toward grey (128) — a multiplication, where eq's brightness adds an offset that crushes dark
// pages to black first.
const SHADE = [
  `boxblur=luma_radius='min(w,h)*${TRANSITION.blur}':luma_power=2`
    + `:chroma_radius='min(cw,ch)*${TRANSITION.blur}':chroma_power=2`,
  `lutyuv=y='16+(val-16)*${TRANSITION.brightness}'`
    + `:u='128+(val-128)*${TRANSITION.brightness}':v='128+(val-128)*${TRANSITION.brightness}'`,
  'format=yuva420p',
].join(',');

// Seconds of held frame added on each side of a join, and what one join adds to the video
const HOLD_OUT = TRANSITION.holdBefore + TRANSITION.fadeOut;
const HOLD_IN = TRANSITION.fadeIn + TRANSITION.holdAfter;
const JOIN = HOLD_OUT + HOLD_IN;

const seconds = (value) => Number(value.toFixed(3));

// Where on the finished video each join's fade plays, from the moment the second scene starts
// moving again. Those frames are a dissolve between two pictures and show neither, so a contact
// sheet leaves them out; the held frames either side are real pictures and stay.
function fadeWindows(playsAt) {
  return playsAt.map((at) => ({
    from: seconds(at - TRANSITION.holdAfter - TRANSITION.fadeIn - TRANSITION.fadeOut),
    to: seconds(at - TRANSITION.holdAfter),
  }));
}

// The encode seeks past the page-load wait first, so every stretch is rebased on that same point.
const rebase = (at, trimAt) => Math.max(0, at - trimAt);

// A stretch that opened and closed inside the same millisecond still held a real frame, and with
// no width at all it would fall out of `all()` below and stay in the video. One frame at the
// slowest rate a recording is allowed to run at, rather than at the rate this one happens to use:
// a floor shorter than a fifth of a second lands between two frames and removes neither.
const MIN_STRETCH = 1 / 5;

function createCuts() {
  const entries = [];
  return {
    // `reason` is what the runbook says the stretch was cut for. A stretch is closed where it
    // ends, including where the take failed inside it, so the video kept from a failure does not
    // keep what the cut was for. An entry never closed reaches no encode.
    open({ reason }) {
      const entry = { from: null, to: null, reason };
      entries.push(entry);
      return entry;
    },
    close(entry, from, to) {
      entry.from = from;
      entry.to = Math.max(to, from + MIN_STRETCH);
    },
    all: () => entries.filter((e) => e.from !== null && e.to !== null && e.to > e.from),
  };
}

// The smallest box holding both: an element measured at either end of a step, which grew or
// shrank in between, fits inside it the whole time.
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

// The graph that removes the cut stretches and joins what is left, or null for a take with
// nothing cut. `removed` and `inserted` are on the trimmed video the encode starts from.
function buildFilter(cuts, trimAt) {
  if (!cuts.length) return null;
  const steps = [];
  let next = 0;
  const take = () => `v${next++}`;
  const removed = mergeRanges(cuts.map((c) => ({
    from: rebase(c.from, trimAt), to: rebase(c.to, trimAt), ...(c.reason ? { reason: c.reason } : {}),
  })));
  const kept = keptSegments(removed);
  const label = joinKept('0:v', kept, take, steps);
  return { graph: steps.join(';'), label, removed, inserted: joinsBetween(kept) };
}

// The kept segments of one stream, played end to end with the held-frame transition at every join
// between two of them. `take` hands out fresh pad names and `steps` collects the filters; the
// label of the joined stream is returned.
function joinKept(label, kept, take, steps) {
  // Each kept segment reads the same stream, and a filter graph lets a pad be consumed once,
  // so it has to be split as many ways as there are segments before any of them is trimmed.
  const sources = kept.map(() => take());
  steps.push(`[${label}]split=${sources.length}${sources.map((s) => `[${s}]`).join('')}`);
  const parts = kept.map((segment, index) => {
    const head = index > 0;
    const tail = index < kept.length - 1;
    return transitionSegment(sources[index], segment, { head, tail }, take, steps);
  });
  const out = take();
  steps.push(`${parts.map((p) => `[${p}]`).join('')}concat=n=${parts.length}:v=1:a=0[${out}]`);
  return out;
}

// One kept segment, with the held frames of each join it is part of. The effect is drawn on
// repeated frames only, never over a frame that shows an action: a click or a page change blurred
// before the viewer has finished reading it is what a transition must not cost.
//
// The order matters: setpts forgets the link's frame rate, and tpad counts its padding in frames
// of that rate, so a tpad after setpts pads nothing and the video comes out 1.4s short per join.
// So the segment is padded while it still has its rate, and moved to zero afterwards. A head pad
// is laid down from zero whatever the first frame's time is, so setpts then moves only the
// segment's own frames down, the ones from the pad's end onwards, by where the segment started.
function transitionSegment(source, segment, { head, tail }, take, steps) {
  const end = segment.end === Infinity ? '' : `:end=${seconds(segment.end)}`;
  const pads = [
    ...(head ? [`start_mode=clone:start_duration=${seconds(HOLD_IN)}`] : []),
    ...(tail ? [`stop_mode=clone:stop_duration=${seconds(HOLD_OUT)}`] : []),
  ];
  const rebaseTo = head
    ? `setpts='PTS-gte(T,${seconds(HOLD_IN)})*${seconds(segment.start)}/TB'`
    : 'setpts=PTS-STARTPTS';
  const padded = take();
  steps.push(`[${source}]trim=start=${seconds(segment.start)}${end},`
    + `${pads.length ? `tpad=${pads.join(':')},` : ''}${rebaseTo}[${padded}]`);
  if (!head && !tail) return padded;

  // A shaded copy over the sharp frame, faded by its alpha: ffmpeg has no blur whose radius moves
  // over time, so "gradually" is a crossfade between the frame and one blurred copy of it. Each copy
  // is trimmed to the frames it fades on, so the blur runs on a fraction of a second, not the take.
  const base = take();
  const heldIn = head ? take() : null;
  const heldOut = tail ? take() : null;
  steps.push(`[${padded}]split=${head && tail ? 3 : 2}[${base}]${heldIn ? `[${heldIn}]` : ''}${heldOut ? `[${heldOut}]` : ''}`);
  let label = base;
  const lay = (copy, fade) => {
    const shaded = take();
    const out = take();
    steps.push(`[${copy}]${fade.trim},${SHADE},${fade.alpha}[${shaded}]`);
    steps.push(`[${label}][${shaded}]overlay=eof_action=pass[${out}]`);
    label = out;
  };
  if (heldIn) {
    // Opens in the shaded state the previous segment closed on, and clears
    lay(heldIn, {
      trim: `trim=end=${seconds(TRANSITION.fadeIn)}`,
      alpha: `fade=t=out:st=0:d=${seconds(TRANSITION.fadeIn)}:alpha=1`,
    });
  }
  if (heldOut) {
    const from = seconds((head ? HOLD_IN : 0) + (segment.end - segment.start) + TRANSITION.holdBefore);
    lay(heldOut, {
      trim: `trim=start=${from}`,
      alpha: `fade=t=in:st=${from}:d=${seconds(TRANSITION.fadeOut)}:alpha=1`,
    });
  }
  return label;
}

// Overlapping or touching cuts have to become one range before anything counts their duration,
// or the same second is subtracted from the timeline twice. A merged range keeps the reason of
// every range in it, with null standing for one that gave none, so the runbook still gives the
// reason of the part that had one. A range where no cut gave a reason keeps none at all.
function mergeRanges(ranges) {
  const sorted = [...ranges].sort((a, b) => a.from - b.from);
  const merged = [];
  for (const { reason, ...range } of sorted) {
    const last = merged[merged.length - 1];
    if (last && range.from <= last.to) {
      last.to = Math.max(last.to, range.to);
      last.reasons = [...new Set([...last.reasons, reason || null])];
    } else {
      merged.push({ ...range, reasons: [reason || null] });
    }
  }
  return merged.map(({ reasons, ...range }) => (
    reasons.some(Boolean) ? { ...range, reasons } : range
  ));
}

// What is left once the removed ranges are taken out. The final segment has no end: the encode
// runs to wherever the source finishes, so a take whose last stretch was cut needs no duration
// passed in and cannot be truncated by one that was measured slightly short. A caller that knows
// the source's length passes it, and a cut that reaches it then leaves no final segment at all —
// without it, that empty segment would count as a scene to join to and gain held frames.
function keptSegments(removed, duration = Infinity) {
  const segments = [];
  let cursor = 0;
  for (const range of removed) {
    if (range.from > cursor) segments.push({ start: cursor, end: range.from });
    cursor = Math.max(cursor, range.to);
  }
  if (cursor < duration - 0.04) segments.push({ start: cursor, end: Infinity });
  return segments.filter((s) => s.end === Infinity || s.end - s.start > 0.04);
}

// The held frames each join adds, at the first moment of the segment after it. A join is between
// two kept segments: the first one kept has nothing before it to come from — a stretch cut from
// the start is a trim, not a change of scene — and the last has nothing after it to go to.
//
// `at` is the segment's start exactly as the removed stretch before it ends, never rounded: a
// stretch ending at 37.687000000000005 and a join rounded to 37.687 puts the join inside the
// stretch, and shiftTime then has no place on the video for the first frame after it.
function joinsBetween(kept) {
  return kept.slice(1).map((segment) => ({ at: segment.start, duration: JOIN }));
}

// Where a moment of the original take ends up once stretches have been removed and held frames
// inserted at the joins. Returns null for a moment inside a removed stretch: the runbook drops
// that row rather than pointing at a second the viewer will find something else at. The first
// instant of a stretch is not inside it — it is where the join is, so a row about the cut itself
// points at the frame held before it. A moment at or after an insertion moves later by its length:
// the first frame of the next segment is shown held before it plays.
function shiftTime(at, removed, inserted = []) {
  let shifted = at;
  for (const range of removed) {
    if (at > range.from && at < range.to) return null;
    if (at >= range.to) shifted -= range.to - range.from;
  }
  for (const insertion of inserted) {
    if (at >= insertion.at) shifted += insertion.duration;
  }
  return Math.max(0, shifted);
}

// The recording's own removed stretches and joins, moved from take time onto the trimmed video the
// encode starts from. Kept apart from the remap so whatever needs to walk those stretches — to
// map a moment of the video back onto the take — reads the same ones the remap does.
function takeStage(trimAt, removed = [], inserted = []) {
  return {
    removed: removed.map((r) => ({ ...r, from: r.from - trimAt, to: r.to - trimAt })),
    inserted: inserted.map((i) => ({ ...i, at: i.at - trimAt })),
  };
}

// Where a moment of the take lands in the finished video. The encode seeks past the page-load
// wait, cut stretches are removed after that, and every join between two kept
// stretches adds held frames — so every section of the runbook has to ask the same question the
// same way: a timestamp that is stale by the length of one removed stretch or one join still
// looks like a timestamp.
//
// Returns null for a moment that was removed: the row is dropped rather than left pointing at a
// second where the viewer will find something else.
const placeAt = (at, trimAt, removed, inserted) => (
  shiftTime(Math.max(0, at - trimAt), removed, inserted)
);

// The same question as a function of one moment of the take, which is what every section is
// handed. `removed` and `inserted` are in take time here, like everything else in the runbook
// data, and moved onto the trimmed video once rather than at every row.
function takeRemap(trimAt, removed = [], inserted = []) {
  const stage = takeStage(trimAt, removed, inserted);
  return (at) => placeAt(at, trimAt, stage.removed, stage.inserted);
}

module.exports = {
  createCuts, buildFilter, joinKept, fadeWindows, shiftTime, unionBox, padBox, mergeRanges, keptSegments,
  joinsBetween, takeStage, placeAt, takeRemap, JOIN,
};
