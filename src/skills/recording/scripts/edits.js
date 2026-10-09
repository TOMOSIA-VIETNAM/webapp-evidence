// The edits a finished take has been given since it was recorded, and where every moment of the
// take lands in the video those edits produce.
//
// Everything here is arithmetic on the take's data (`<name>-timeline.json`) and the list kept in
// `<name>-edits.json`, so it is testable without a video. Each edit is stored in seconds of the
// take as recorded — the same clock every mark and screenshot in the timeline uses — so dropping
// an earlier edit, a speed change say, cannot move a later one off the moment it was aimed at.
//
// A take passes through three stages on its way to the edited video, in the order the render
// applies them:
//
//   take time      the clock of the timeline: marks, screenshots, every stored edit
//   recorded video the take's own trim and removed stretches with their held frames, as record.js
//                  encoded it into <name>.mp4 — what every render starts from
//   cut video      the edit list's trim and cuts taken out of that, with a held-frame transition
//                  at every join between two kept stretches, exactly as buildFilter makes one
//   edited video   the cut video with every speed change applied to its footage. The held frames
//                  of a join play at their own length at any speed: a transition sped up with the
//                  footage around it would flash past before the viewer has read either picture
const fs = require('fs');
const path = require('path');
const {
  shiftTime, mergeRanges, keptSegments, joinsBetween, fadeWindows, takeStage, placeAt, JOIN,
} = require('./cuts');
const { DRAW } = require('./style');

const KINDS = ['speed', 'cover', 'highlight', 'arrow', 'cut', 'trim'];
const BOXED = ['cover', 'highlight', 'arrow'];

const seconds = (value) => Number(value.toFixed(3));

// ---------- the file ----------

// Beside what it edits, named after it: `<name>.mp4` keeps its list in `<name>-edits.json`, and a
// screenshot `NN-shot.png` in `NN-shot-edits.json`, so a video and its screenshots never share one.
function editsFile(target) {
  const { dir, name } = path.parse(target);
  return path.join(dir, `${name}-edits.json`);
}

// A take nobody has edited has no file yet, which is the same as an empty list.
function load(file) {
  if (!fs.existsSync(file)) return [];
  return JSON.parse(fs.readFileSync(file, 'utf8')).edits;
}

function save(file, edits) {
  fs.writeFileSync(file, `${JSON.stringify({ edits }, null, 2)}\n`);
}

// ---------- the list ----------

const append = (edits, edit) => [...edits, edit];

// `n` counts from 1, as `list` numbers the edits, and defaults to the last one.
function undo(edits, n = edits.length) {
  if (!edits.length) throw new Error('There is no edit to undo.');
  if (!Number.isInteger(n) || n < 1 || n > edits.length) {
    throw new Error(`There is no edit ${n}: the list has ${edits.length}, numbered from 1.`);
  }
  return { edits: edits.filter((_, i) => i !== n - 1), dropped: edits[n - 1] };
}

const reset = () => [];

// ---------- one stage of removed stretches ----------

// A moment inside a removed stretch is placed at the stretch's start — the join, where the frame
// before it is held. That is where the stretch is on the video, and it keeps a range that starts
// or ends inside one covering everything on screen around the join rather than nothing.
const outsideRemoved = (at, removed) => removed.find((r) => at > r.from && at < r.to)?.from ?? at;
const placeNear = (at, stage) => shiftTime(outsideRemoved(at, stage.removed), stage.removed, stage.inserted);

// The inverse of shiftTime: where on the stage's input a moment of its output came from. A moment
// on the held frames of a join resolves to the picture they show — the last moment before the
// join on the first half of them, the first moment after it on the second — so a range read off
// the video around a join lands on footage, not on the stretch that was taken out.
function unshift(out, stage) {
  const { removed, inserted, duration } = stage;
  let previous = null;
  for (const segment of keptSegments(removed, duration)) {
    const start = shiftTime(segment.start, removed, inserted);
    if (out < start) {
      if (!previous) return segment.start;
      const previousEnd = shiftTime(previous.end, removed, inserted);
      return out - previousEnd < start - out ? previous.end : segment.start;
    }
    if (out <= start + (segment.end - segment.start)) return segment.start + (out - start);
    previous = segment;
  }
  return previous ? previous.end : 0;
}

// ---------- speed ----------

// The cut video split where any speed change starts or stops, each piece with the product of
// every change covering it: two edits on the same stretch compound, as applying one after the
// other would, and the result does not depend on which was asked for first. A piece on the held
// frames of a join keeps factor 1 whatever covers it — speed is for footage.
function speedPieces(changes, held = []) {
  const points = [...new Set([0, ...[...changes, ...held].flatMap((c) => [c.from, c.to])])]
    .filter((p) => Number.isFinite(p))
    .sort((a, b) => a - b);
  return points.map((from, i) => {
    const to = points[i + 1] ?? Infinity;
    const factor = held.some((h) => h.from <= from && h.to > from) ? 1 : changes
      .filter((c) => c.from <= from && c.to > from)
      .reduce((product, c) => product * c.factor, 1);
    return { from, to, factor };
  });
}

// Where the held frames of joins are on the cut video: the recording's own, wherever the edit
// list left them in, and one stretch for every join the cuts made. A join's held frames end where
// the footage after it starts playing, which is the moment shiftTime gives that footage.
function heldOnCut(recorded, cut) {
  const ofRecording = recorded.inserted
    .map((i) => shiftTime(i.at, recorded.removed, recorded.inserted))
    // A cut either keeps a join's held frames whole or takes them out whole — no target lands
    // inside them, see unshift — so their middle says which.
    .filter((end) => shiftTime(end - JOIN / 2, cut.removed, cut.inserted) !== null)
    .map((end) => shiftTime(end, cut.removed, cut.inserted));
  const ofCuts = cut.inserted.map((i) => shiftTime(i.at, cut.removed, cut.inserted));
  return [...ofRecording, ...ofCuts].map((end) => ({ from: seconds(end - JOIN), to: seconds(end) }));
}

function speedUp(at, pieces) {
  return pieces.reduce((out, p) => (at > p.from ? out + (Math.min(at, p.to) - p.from) / p.factor : out), 0);
}

function slowDown(out, pieces) {
  let elapsed = 0;
  for (const p of pieces) {
    const length = (p.to - p.from) / p.factor;
    if (out <= elapsed + length) return p.from + (out - elapsed) * p.factor;
    elapsed += length;
  }
  return pieces[pieces.length - 1].to;
}

// ---------- the edited video ----------

// Everything about the video the edit list produces, from the take's data and the list alone.
//
// `cut` is in seconds of the recorded video and `speed` in seconds of the cut video, which is what
// the render needs; `toRecorded` places a moment of the take on the recorded video, and `toEdited`
// and `toTake` convert single moments between the take and the edited video; `duration` and
// `fades` are the edited video's, `fades` in the same form record.js writes for its own video, so
// the contact sheet skips the dissolves of both.
function editedVideo(take, edits) {
  const recorded = takeStage(take.trimAt, take.removed, take.inserted);
  const toRecorded = (at) => placeNear(Math.max(0, at - take.trimAt), recorded);

  // A cut that runs to the end of the recorded video is a trim of its end: nothing comes after it,
  // so there is no join and no held frames, which knowing the duration is what lets keptSegments
  // see. Every range is held inside the recorded video for the same reason.
  const ranges = [];
  for (const edit of edits) {
    if (edit.kind === 'cut') ranges.push({ from: toRecorded(edit.range.from), to: toRecorded(edit.range.to) });
    if (edit.kind === 'trim' && edit.start != null) ranges.push({ from: 0, to: toRecorded(edit.start) });
    if (edit.kind === 'trim' && edit.end != null) ranges.push({ from: toRecorded(edit.end), to: take.duration });
  }
  const removed = mergeRanges(ranges
    .map((r) => ({ from: Math.max(0, r.from), to: Math.min(take.duration, r.to) }))
    .filter((r) => r.to > r.from));
  const cut = { removed, inserted: joinsBetween(keptSegments(removed, take.duration)), duration: take.duration };
  const cutLength = shiftTime(take.duration, cut.removed, cut.inserted);
  const toCut = (at) => placeNear(toRecorded(at), cut);

  const speed = speedPieces(edits.filter((e) => e.kind === 'speed').map((e) => ({
    factor: e.factor,
    from: e.range ? toCut(e.range.from) : 0,
    to: e.range ? toCut(e.range.to) : Infinity,
  })), heldOnCut(recorded, cut));

  // A moment of the recorded video through the cut and the speed change; null if it was cut out
  const fromRecorded = (at) => {
    const onCut = shiftTime(at, cut.removed, cut.inserted);
    return onCut === null ? null : seconds(speedUp(onCut, speed));
  };

  const duration = seconds(speedUp(cutLength, speed));
  // The recording's own dissolves come along unless an edit cut them out, and every join the
  // edits made adds one, placed on the cut video and then carried through the speed change.
  const fades = [
    ...(take.fades ?? []).map((f) => ({ from: fromRecorded(f.from), to: fromRecorded(f.to) })),
    ...fadeWindows(cut.inserted.map((i) => shiftTime(i.at, cut.removed, cut.inserted)))
      .map((f) => ({ from: seconds(speedUp(f.from, speed)), to: seconds(speedUp(f.to, speed)) })),
  ].filter((f) => f.from !== null && f.to !== null).sort((a, b) => a.from - b.from);

  return {
    cut, speed, duration, fades, toRecorded,
    // Null for a moment that is not in the edited video, as the runbook's own remap does, so the
    // edited runbook drops that row the same way.
    toEdited(at) {
      const onRecorded = placeAt(at, take.trimAt, recorded.removed, recorded.inserted);
      return onRecorded === null ? null : fromRecorded(onRecorded);
    },
    // Where a moment that is not in the edited video would have been: at the join that replaced it.
    // For describing a range, which still has a place on the video even once part of it is gone.
    placeOnEdited: (at) => seconds(speedUp(toCut(at), speed)),
    // A moment the viewer saw, back onto the take. Read off the video as it is, so past its end is
    // its end.
    toTake(at) {
      const onCut = slowDown(Math.min(Math.max(0, at), duration), speed);
      return seconds(unshift(unshift(onCut, cut), recorded) + take.trimAt);
    },
    // The last moment of the take that is in the recorded video, for a range that runs to the end
    takeEnd: seconds(unshift(take.duration, recorded) + take.trimAt),
  };
}

// ---------- turning a request into an edit ----------

// `x,y,w,h` in frame pixels, the frame the timeline's boxes are measured in
function parseBox(text) {
  const parts = String(text).split(',').map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n)) || parts[2] <= 0 || parts[3] <= 0) {
    throw new Error(`A box is x,y,width,height in frame pixels, like 40,60,200,30 — got "${text}".`);
  }
  const [x, y, width, height] = parts;
  return { x, y, width, height };
}

// A step runs from its own mark to the next one; the last runs to the end of the take
function stepTarget(take, label, video) {
  const index = take.marks.findIndex((m) => m.label === label);
  if (index === -1) {
    const known = take.marks.map((m) => `  "${m.label}"`).join('\n') || '  (the take has no steps)';
    throw new Error(`No step is labelled "${label}". The steps in this take are:\n${known}`);
  }
  const mark = take.marks[index];
  return {
    label,
    box: mark.box,
    range: { from: mark.at, to: take.marks[index + 1]?.at ?? video.takeEnd },
  };
}

// The least a highlight or an arrow stays on screen: its drawing, then a second fully drawn
const shortestMark = (kind) => (kind === 'arrow' ? DRAW.outline + DRAW.shaft : DRAW.outline) + DRAW.still;

// Measured on the edited video as it is when the mark is added, which is what the viewer will
// watch it on. The drawing plays inside the range, never before it, so the end moves later — or,
// against the end of the video, the start moves earlier.
function lengthened(kind, range, video) {
  const shortest = shortestMark(kind);
  const from = video.placeOnEdited(range.from);
  const to = video.placeOnEdited(range.to);
  if (to - from >= shortest) return range;
  const end = Math.min(video.duration, from + shortest);
  const start = Math.max(0, end - shortest);
  return {
    from: start === from ? range.from : video.toTake(start),
    to: video.toTake(end),
  };
}

// One request — what the user asked for, with the targets as the command line gives them — turned
// into the edit stored in the list, every time in take seconds. `edits` is the list so far: --at
// and --to are read on the video it produces, which is the one the user watched.
//
// Targets combine: --step gives a box and a range, and --box or --at/--to given with it replace
// that part of it. A mark with no time given covers the whole take.
function resolve(request, take, edits) {
  const { kind } = request;
  if (!KINDS.includes(kind)) throw new Error(`Unknown edit "${kind}". The edits are: ${KINDS.join(', ')}.`);
  const video = editedVideo(take, edits);
  const step = request.step != null ? stepTarget(take, request.step, video) : null;
  const timed = request.at != null || request.to != null;
  const range = timed
    ? { from: video.toTake(request.at ?? 0), to: video.toTake(request.to ?? video.duration) }
    : step?.range ?? null;
  if (range && range.to <= range.from) {
    throw new Error('The range ends before it starts, or is not in the edited video at all.');
  }
  const named = step ? { step: step.label } : {};

  if (kind === 'trim') {
    if (request.start == null && request.end == null) throw new Error('A trim needs a start, an end, or both.');
    return {
      kind,
      ...(request.start != null ? { start: video.toTake(request.start) } : {}),
      ...(request.end != null ? { end: video.toTake(request.end) } : {}),
    };
  }
  if (kind === 'speed') {
    const factor = Number(request.factor);
    if (!Number.isFinite(factor) || factor <= 0) throw new Error(`A speed is a factor above 0, like 2 or 0.5 — got "${request.factor}".`);
    return { kind, factor, ...(range ? { range } : {}), ...named };
  }
  if (kind === 'cut') {
    if (!range) throw new Error('A cut needs a time range: --step, or --at and --to.');
    return { kind, range, ...named };
  }

  const box = request.box != null ? parseBox(request.box) : step?.box ?? null;
  if (!box) {
    throw new Error(step
      ? `Step "${step.label}" acted on no element, so it has no box. Give one with --box x,y,w,h.`
      : `A ${kind} needs a box: --step, or --box x,y,w,h.`);
  }
  const span = range ?? { from: take.trimAt, to: video.takeEnd };
  return { kind, box, range: kind === 'cover' ? span : lengthened(kind, span, video), ...named };
}

// A box of the take — frame pixels of the video — on a screenshot of the same take. The two are the
// same for a page take. A window or screen take's frame is the whole window in physical pixels,
// while a screenshot is the page alone at the same scale, so only the offset of the page inside the
// window comes off.
function frameToShot(box, pageInFrame) {
  if (!box || !pageInFrame) return box;
  const { x, y, scale } = pageInFrame;
  return { ...box, x: box.x - Math.round(x * scale), y: box.y - Math.round(y * scale) };
}

// One request on a screenshot turned into the edit stored in its own list. A screenshot is one
// moment, so the edit is a box and nothing else.
//
// `--step` with a label is that step's box; with none, it is what the screenshot was taken around:
// its own box, else the box of the step that was open when it was taken. `--box` is in the
// screenshot's own pixels, which is what the user is looking at.
function resolveShot(request, take, file) {
  const { kind } = request;
  if (!BOXED.includes(kind)) {
    throw new Error(`A screenshot takes ${BOXED.join(', ')}; ${kind} is for the video.`);
  }
  if (request.at != null || request.to != null) {
    throw new Error('A screenshot is one moment, so it has no time range: --at and --to are for the video.');
  }
  const shot = take.screenshots?.find((s) => s.file === file);
  if (!shot) throw new Error(`The take does not list the screenshot ${file}.`);
  if (request.box != null) return { kind, box: parseBox(request.box) };
  if (request.step == null) throw new Error(`A ${kind} needs a box: --step, or --box x,y,w,h.`);

  const open = shot.at == null ? undefined : take.marks.filter((m) => m.at <= shot.at).at(-1);
  const step = request.step ? stepTarget(take, request.step, editedVideo(take, [])) : null;
  const label = step?.label ?? open?.label;
  const box = step ? step.box : shot.box ?? open?.box ?? null;
  if (!box) {
    throw new Error(label
      ? `Step "${label}" acted on no element, so it has no box. Give one with --box x,y,w,h.`
      : `${file} was taken around no element and inside no step. Give a box with --box x,y,w,h.`);
  }
  return { kind, box: frameToShot(box, take.pageInFrame), ...(label ? { step: label } : {}) };
}

// ---------- the list in words ----------

// Minutes, seconds and a tenth: an edit is often shorter than a second, which the runbook's
// whole seconds would round away.
const clock = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${(s % 60).toFixed(1).padStart(4, '0')}`;

function describe(edit, take, video) {
  const span = (r) => `${clock(video.placeOnEdited(r.from))} to ${clock(video.placeOnEdited(r.to))}`;
  const where = (r) => (edit.step ? `step "${edit.step}", ${span(r)}` : span(r));
  // A step names the element better than its pixels do; a box given by hand has nothing else
  const target = () => (edit.step
    ? `on step "${edit.step}"`
    : `at ${[edit.box.x, edit.box.y].map(Math.round).join(',')} ${[edit.box.width, edit.box.height].map(Math.round).join('x')}`);
  switch (edit.kind) {
    case 'speed':
      return `speed ${edit.factor}x, ${edit.range ? where(edit.range) : 'the whole video'}`;
    case 'cut':
      return `cut ${(edit.range.to - edit.range.from).toFixed(1)}s${edit.step ? ` (step "${edit.step}")` : ''}, joined at ${clock(video.placeOnEdited(edit.range.from))}`;
    case 'trim':
      // In seconds of the recorded video: how much footage went, before any speed change
      return `trim ${[
        ...(edit.start != null ? [`${video.toRecorded(edit.start).toFixed(1)}s off the start`] : []),
        ...(edit.end != null ? [`${(take.duration - video.toRecorded(edit.end)).toFixed(1)}s off the end`] : []),
      ].join(' and ')}`;
    default: {
      // Set by the last render, when every path an arrow could take crossed something
      const drawn = edit.arrowLeftOut ? ' — drawn as its highlight alone: every path to it crossed text or a control' : '';
      // A screenshot's edits have no range, only the step their box came from
      if (!edit.range) return `${edit.kind} ${target()}${drawn}`;
      return `${edit.kind} ${target()}, ${span(edit.range)}${drawn}`;
    }
  }
}

// Numbered from 1, the numbers `undo` takes, with every time on the video the whole list produces
function formatList(edits, take) {
  if (!edits.length) return 'No edits yet.';
  const video = editedVideo(take, edits);
  return edits.map((edit, i) => `${i + 1}. ${describe(edit, take, video)}`).join('\n');
}

module.exports = {
  editsFile, load, save, append, undo, reset, editedVideo, resolve, resolveShot, parseBox, formatList,
};
