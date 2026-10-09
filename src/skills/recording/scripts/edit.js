#!/usr/bin/env node
// Edit a finished take without recording it again: faster, a stretch taken out, something covered,
// an element pointed at. What the user asks for after watching a take is almost never a reason to
// record it again — the video and the take's timeline already hold everything those edits need.
//
// Every run re-renders the whole edit list from the untouched `<name>.mp4`, so however many rounds
// of edits there are, the edited video is one encode away from the recording. The recording, its
// screenshots and its runbook are only ever read.
//
// The render, in the order it is applied:
//   covers           on the recorded video, before anything moves: a cover follows the content
//                    it hides, and that content is where the recording has it
//   trim and cuts    with the held-frame transition at every join, as the runner makes one
//   speed            on the footage only; the held frames of a join play at their own length
//   highlights and   on the finished timeline, so the drawing-on always plays at real time
//   arrows           whatever speed the footage around it runs at
//
// A screenshot of the take gets the same covers, highlights and arrows, finished rather than drawn
// on, from its own edit list and its own untouched PNG.
//
// Usage: node edit.js <OUT_DIR>/<name>.mp4 <operation> [target] [options]   (see --help)
//        node edit.js <OUT_DIR>/NN-<shot>.png <operation> [target]
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const {
  editsFile, load, save, append, undo, editedVideo, resolve, resolveShot, formatList,
} = require('./edits');
const { joinKept, keptSegments, padBox, shiftTime } = require('./cuts');
const { DRAW, scaled } = require('./style');
const { svgFor, chooseArrow, lumaFrames, renderOver, renderTransparent, pngSize } = require('./overlay');
const { resolveSettings, mp4Encode } = require('./settings');
const { renderRunbook } = require('./record');

const seconds = (value) => Number(value.toFixed(3));

// ---------- the render, as plain data ----------

// How many video frames a mark takes to draw itself
const drawingFrames = (kind, fps) => Math.ceil((kind === 'arrow' ? DRAW.outline + DRAW.shaft : DRAW.outline) * fps - 1e-9);

// A highlight or an arrow on the edited video: where it starts, how many frames it takes to draw
// itself, and where it goes. Placed on whole frames, so the first drawing frame is the frame the
// mark is said to start on. A mark whose whole range was cut out is not drawn at all; one that a
// later speed change squeezed shorter than its drawing still draws itself in full. `edit` is the
// mark's place in the list, for telling the list what was drawn.
function planMarks(video, edits, fps) {
  const onFrame = (at) => Math.round(at * fps) / fps;
  return edits
    .map((e, edit) => ({ e, edit }))
    .filter(({ e }) => e.kind === 'highlight' || e.kind === 'arrow')
    .map(({ e, edit }) => {
      const frames = drawingFrames(e.kind, fps);
      const from = onFrame(video.placeOnEdited(e.range.from));
      const to = onFrame(video.placeOnEdited(e.range.to));
      if (to <= from) return null;
      return {
        kind: e.kind, box: e.box, step: e.step, edit, from: seconds(from), frames,
        to: seconds(Math.min(video.duration, Math.max(to, from + frames / fps))),
      };
    })
    .filter(Boolean);
}

// The one line said when an arrow is drawn as its highlight alone
const leftOutLine = (mark) => `The arrow on ${mark.step ? `step "${mark.step}"` : `the box ${mark.box.x},${mark.box.y} `
  + `${mark.box.width}x${mark.box.height}`} is left out, its highlight drawn alone: every path to it crosses text or another control.`;

// The list as rendered: an arrow that was drawn as its highlight alone says so, and one drawn says
// nothing, so a re-render on a different picture never leaves a stale note behind.
const markLeftOut = (edits, leftOut) => edits.map((e, i) => {
  if (e.kind !== 'arrow') return e;
  const { arrowLeftOut, ...rest } = e;
  return leftOut.includes(i) ? { ...rest, arrowLeftOut: true } : rest;
});

// The images one mark is laid over the video with: one per frame of its drawing, `progress` going
// up to 1 on the last, then the finished mark that is held until the mark's end.
function markImages(mark, frame) {
  const { kind, box, side, length } = mark;
  const draw = (progress) => svgFor({ kind, box, frame, side, length, progress });
  const drawing = Array.from({ length: mark.frames }, (_, k) => draw((k + 1) / mark.frames));
  return { drawing, finished: draw(1) };
}

// Pixelated rather than blurred: a mosaic reads as "hidden on purpose", where a blur in the middle
// of a working page reads as a rendering fault. Scaled down by averaging, so each block takes the
// mean colour of what it hides — sampling one pixel per block instead picks the background between
// the letters, and the cover comes out as an empty patch that reads as nothing was there — then back
// up with nearest-neighbour, so each block is one flat colour and no letter survives in it.
function pixelate(cover, label, frame, take, steps) {
  const { x, y, width, height } = padBox(cover.box, 0, frame);
  const block = scaled(frame.width).coverBlock;
  const base = take();
  const source = take();
  const mosaic = take();
  const out = take();
  steps.push(`[${label}]split=2[${base}][${source}]`);
  steps.push(`[${source}]crop=${width}:${height}:${x}:${y},`
    + `scale=${Math.max(1, Math.round(width / block))}:${Math.max(1, Math.round(height / block))}:flags=area,`
    + `scale=${width}:${height}:flags=neighbor[${mosaic}]`);
  steps.push(`[${base}][${mosaic}]overlay=${x}:${y}:enable='between(t,${cover.from},${cover.to})'[${out}]`);
  return out;
}

// The cut video played piece by piece at each piece's speed, then put back on the take's frame
// rate: a piece at 2x carries twice the frames per second until `fps` drops the extra ones, and
// the marks laid on afterwards are drawn one image per output frame.
function speedStage(label, pieces, length, fps, take, steps) {
  const played = pieces.filter((p) => p.from < length - 1 / fps);
  const sources = played.map(() => take());
  steps.push(`[${label}]split=${sources.length}${sources.map((s) => `[${s}]`).join('')}`);
  const parts = played.map((piece, i) => {
    const out = take();
    const end = piece.to === Infinity ? '' : `:end=${seconds(piece.to)}`;
    const rate = piece.factor === 1 ? '' : `/${piece.factor}`;
    steps.push(`[${sources[i]}]trim=start=${seconds(piece.from)}${end},setpts=(PTS-STARTPTS)${rate}[${out}]`);
    return out;
  });
  const out = take();
  steps.push(`${parts.map((p) => `[${p}]`).join('')}concat=n=${parts.length}:v=1:a=0,fps=${fps}[${out}]`);
  return out;
}

// The whole filter graph for an edit list, and the extra inputs it reads. Input 0 is the recorded
// video; each mark adds its drawing as an image sequence and its finished image looped for as
// long as it is held, both shifted onto the moment the mark starts. `marks[i].files` names those
// two files: `{ drawing: '<dir>/%03d.png', finished: '<file>.png' }`.
function buildGraph({ take: takeData, edits, fps, marks = [] }) {
  const video = editedVideo(takeData, edits);
  const frame = takeData.frame;
  const steps = [];
  let next = 0;
  const take = () => `v${next++}`;
  let label = '0:v';

  for (const edit of edits.filter((e) => e.kind === 'cover')) {
    const cover = {
      box: edit.box,
      from: seconds(video.toRecorded(edit.range.from)),
      to: seconds(video.toRecorded(edit.range.to)),
    };
    label = pixelate(cover, label, frame, take, steps);
  }

  if (video.cut.removed.length) {
    label = joinKept(label, keptSegments(video.cut.removed, video.cut.duration), take, steps);
  }

  if (video.speed.some((p) => p.factor !== 1)) {
    const length = shiftTime(video.cut.duration, video.cut.removed, video.cut.inserted);
    label = speedStage(label, video.speed, length, fps, take, steps);
  }

  const inputs = [];
  marks.forEach((mark, i) => {
    const drawEnd = seconds(mark.from + mark.frames / fps);
    const drawing = 1 + 2 * i;
    inputs.push('-framerate', String(fps), '-i', mark.files.drawing);
    inputs.push('-loop', '1', '-framerate', String(fps), '-t', String(seconds(Math.max(0, mark.to - drawEnd))),
      '-i', mark.files.finished);
    // Each image stream ends where its part of the mark does, and `eof_action=pass` lets the video
    // through untouched from then on: the mark goes in one frame, rather than the last image being
    // repeated to the end of the take, which is what overlay does by default.
    for (const [input, at] of [[drawing, mark.from], [drawing + 1, drawEnd]]) {
      const shifted = take();
      const out = take();
      steps.push(`[${input}:v]setpts=PTS-STARTPTS+${at}/TB[${shifted}]`);
      steps.push(`[${label}][${shifted}]overlay=eof_action=pass[${out}]`);
      label = out;
    }
  });

  if (!steps.length) {
    const out = take();
    steps.push(`[${label}]null[${out}]`);
    label = out;
  }
  return { graph: steps.join(';'), label, inputs, video };
}

// ---------- files ----------

function takeFiles(video) {
  const dir = path.dirname(video);
  const name = path.basename(video, path.extname(video));
  return {
    dir,
    name,
    timeline: path.join(dir, `${name}-timeline.json`),
    edits: editsFile(video),
    edited: path.join(dir, `${name}-edited.mp4`),
    // Named so the contact sheet finds it beside the edited video the way it finds the take's
    // beside the take: `<video name>-timeline.json`.
    editedTimeline: path.join(dir, `${name}-edited-timeline.json`),
  };
}

function readTake(video, files) {
  if (!fs.existsSync(video)) throw new Error(`No such video: ${video}`);
  if (files.name.endsWith('-edited')) {
    throw new Error('This is an edited video. Edits are applied to the recording: pass '
      + `${path.join(files.dir, `${files.name.replace(/-edited$/, '')}.mp4`)} instead.`);
  }
  if (!fs.existsSync(files.timeline)) {
    throw new Error(`No ${path.basename(files.timeline)} beside the video. edit.js edits a take that `
      + 'record.js wrote; record it again with the current runner to get one.');
  }
  return JSON.parse(fs.readFileSync(files.timeline, 'utf8'));
}

// A screenshot keeps its list and its result beside it, as the video does: `NN-shot-edits.json`,
// `NN-shot-edited.png`. `shot` is its file name, as the take's timeline lists it.
function shotFiles(png) {
  const dir = path.dirname(png);
  const name = path.basename(png, path.extname(png));
  return {
    dir, name, shot: path.basename(png), edits: editsFile(png), edited: path.join(dir, `${name}-edited.png`),
  };
}

// The take a screenshot belongs to: the one whose timeline in the same directory lists it. An
// OUT_DIR usually holds one take, but nothing stops a second step script writing into it.
function readShotTake(png, files) {
  if (!fs.existsSync(png)) throw new Error(`No such screenshot: ${png}`);
  if (files.name.endsWith('-edited')) {
    throw new Error('This is an edited screenshot. Edits are applied to the one the take wrote: pass '
      + `${path.join(files.dir, `${files.name.replace(/-edited$/, '')}.png`)} instead.`);
  }
  const takes = fs.readdirSync(files.dir)
    .filter((f) => f.endsWith('-timeline.json') && !f.endsWith('-edited-timeline.json'))
    .map((f) => JSON.parse(fs.readFileSync(path.join(files.dir, f), 'utf8')));
  const take = takes.find((t) => t.screenshots?.some((s) => s.file === files.shot));
  if (!take) {
    throw new Error(`No take timeline in ${files.dir} lists ${files.shot}. edit.js edits a screenshot `
      + 'that record.js wrote; record it again with the current runner to get one.');
  }
  return take;
}

// What the command line names, a video or a screenshot, with the files and the take it belongs to
function openTarget(file) {
  const source = path.resolve(file);
  if (path.extname(source).toLowerCase() === '.png') {
    const files = shotFiles(source);
    return { source, files, take: readShotTake(source, files) };
  }
  const files = takeFiles(source);
  return { source, files, take: readTake(source, files) };
}

function frameRate(video) {
  const [num, den] = execFileSync('ffprobe', [
    '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=r_frame_rate', '-of', 'csv=p=0', video,
  ], { encoding: 'utf8' }).trim().split('/').map(Number);
  return num / (den || 1);
}

function durationOf(video) {
  return Number(execFileSync('ffprobe', [
    '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', video,
  ], { encoding: 'utf8' }).trim());
}

// The encoder settings the take was recorded with, from the project's config if it still exists:
// an edited video should look like the take it came from.
function encodeSettings(take) {
  const config = take.configFile && fs.existsSync(take.configFile) ? require(take.configFile) : {};
  return resolveSettings(config).recording.video;
}

// Each arrow's side, chosen on the frame it starts on as the edited video shows it before any mark
// is laid over it: covered, cut and sped up, which is the picture the arrow is drawn onto. One
// decode of the take picks every one of those frames, a half-frame window round each start.
function chooseSides(video, take, edits, fps, marks) {
  const arrows = marks.filter((m) => m.kind === 'arrow');
  if (!arrows.length) return marks;
  const starts = [...new Set(arrows.map((m) => m.from))].sort((a, b) => a - b);
  const half = 0.5 / fps;
  const pick = starts.map((at) => `gte(t,${seconds(at - half)})*lt(t,${seconds(at + half)})`).join('+');
  const { graph, label } = buildGraph({ take, edits, fps });
  const pictures = lumaFrames([
    '-i', video, '-filter_complex', `${graph};[${label}]select='${pick}'[picked]`,
    '-map', '[picked]', '-fps_mode', 'passthrough',
  ], take.frame);
  if (pictures.length !== starts.length) {
    throw new Error(`Expected ${starts.length} frames to place the arrows on, the video gave ${pictures.length}.`);
  }
  const s = scaled(take.frame.width);
  return marks.map((mark) => {
    if (mark.kind !== 'arrow') return mark;
    const chosen = chooseArrow({ box: mark.box, frame: take.frame, s, luma: pictures[starts.indexOf(mark.from)] });
    if (chosen) return { ...mark, side: chosen.side, length: chosen.length };
    console.log(leftOutLine(mark));
    return { ...mark, kind: 'highlight', frames: drawingFrames('highlight', fps), arrowLeftOut: true };
  });
}

// Renders into a scratch file and moves it into place once ffmpeg has finished, so a render that
// fails leaves the previous edited video as it was rather than half of a new one. Returns the
// edited video and the list as it was drawn.
async function render(video, take, edits, files) {
  const fps = frameRate(video);
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'webapp-evidence-edit-'));
  try {
    const planned = planMarks(editedVideo(take, edits), edits, fps);
    const marks = chooseSides(video, take, edits, fps, planned).map((mark, i) => {
      const dir = path.join(scratch, `mark-${i}`);
      fs.mkdirSync(dir);
      return { ...mark, files: { drawing: path.join(dir, '%03d.png'), finished: path.join(scratch, `mark-${i}.png`) } };
    });
    const images = marks.flatMap((mark) => {
      const { drawing, finished } = markImages(mark, take.frame);
      return [
        ...drawing.map((svg, k) => ({ svg, path: mark.files.drawing.replace('%03d', String(k).padStart(3, '0')) })),
        { svg: finished, path: mark.files.finished },
      ];
    });
    if (images.length) await renderTransparent(images, take.frame);

    const { graph, label, inputs, video: edited } = buildGraph({ take, edits, fps, marks });
    const partial = path.join(scratch, 'edited.mp4');
    execFileSync('ffmpeg', [
      '-y', '-v', 'error', '-i', video, ...inputs,
      '-filter_complex', graph, '-map', `[${label}]`,
      ...mp4Encode(encodeSettings(take)), partial,
    ]);
    fs.renameSync(partial, files.edited);
    fs.writeFileSync(files.editedTimeline, `${JSON.stringify({
      video: files.edited, frame: take.frame, duration: edited.duration, fades: edited.fades,
    }, null, 2)}\n`);
    return { edited, edits: markLeftOut(edits, marks.filter((m) => m.arrowLeftOut).map((m) => m.edit)) };
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
}

// The screenshot's whole list from the PNG the take wrote: covers first, with the pixelate the
// video gets, then every highlight and arrow finished over the covered picture, each arrow chosen
// on it. Written to a scratch file and moved into place, as the video is. Returns the list as it
// was drawn.
async function renderShot(files, edits) {
  const original = path.join(files.dir, files.shot);
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'webapp-evidence-edit-'));
  try {
    let picture = original;
    const covers = edits.filter((e) => e.kind === 'cover');
    if (covers.length) {
      const steps = [];
      let next = 0;
      const take = () => `v${next++}`;
      const frame = pngSize(original);
      // A still image is its first frame, t=0, so a range from 0 enables every cover on it
      const label = covers.reduce((from, c) => pixelate({ box: c.box, from: 0, to: 1 }, from, frame, take, steps), '0:v');
      picture = path.join(scratch, 'covered.png');
      execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', original, '-filter_complex', steps.join(';'),
        '-map', `[${label}]`, '-frames:v', '1', picture]);
    }
    const marks = edits
      .map(({ kind, box, step }, edit) => ({ kind, box, step, edit }))
      .filter((m) => m.kind !== 'cover');
    const partial = path.join(scratch, 'edited.png');
    const drawn = marks.length ? await renderOver(picture, marks, partial) : [];
    if (!marks.length) fs.copyFileSync(picture, partial);
    fs.renameSync(partial, files.edited);
    const leftOut = drawn.filter((m, i) => marks[i].kind === 'arrow' && m.kind !== 'arrow');
    for (const mark of leftOut) console.log(leftOutLine(mark));
    return markLeftOut(edits, leftOut.map((m) => m.edit));
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
}

// ---------- the edited runbook ----------

// What was added to the take after it was recorded, so a reviewer reads a highlight as a note on
// the evidence rather than as part of the application's UI.
function editsSection(take, edits, shots) {
  const lists = [
    ...(edits.length ? [`On the video, times on the edited video:\n\n${formatList(edits, take)}`] : []),
    ...shots.map(({ file, edits: shotEdits }) => `On ${file}:\n\n${formatList(shotEdits, take)}`),
  ];
  return '## Edits applied after recording\n\n'
    + 'The highlights, arrows and covers listed here were added to the evidence after the take was recorded. '
    + 'They are annotations, not part of the application.\n\n'
    + `${lists.join('\n\n')}\n\n`;
}

// The take's runbook describing the edited video and screenshots: rendered by the function that
// wrote the take's own, with every moment remapped onto the edited video — a step inside a cut is
// dropped — and the edits listed after the steps. `shots` is [{ file, edits }] for each screenshot
// with edits of its own; with no video edits the video is the recording itself.
function editedRunbook(take, edits, shots, dir) {
  const video = editedVideo(take, edits);
  const edited = new Set(shots.map((s) => s.file));
  const data = {
    ...take,
    video: path.join(dir, `${take.name}${edits.length ? '-edited' : ''}.mp4`),
    screenshots: (take.screenshots ?? []).map((s) => (
      edited.has(s.file) ? { ...s, file: s.file.replace(/\.png$/, '-edited.png') } : s
    )),
  };
  return renderRunbook(data, { remap: video.toEdited, duration: video.duration, added: editsSection(take, edits, shots) });
}

// Written from every list the take has on disk, the video's and each screenshot's, so whichever was
// edited last the runbook covers all of them. Removed once no list has an edit left.
function writeEditedRunbook(take, dir) {
  const file = path.join(dir, `${take.name}-edited-runbook.md`);
  const edits = load(editsFile(path.join(dir, `${take.name}.mp4`)));
  const shots = (take.screenshots ?? [])
    .map(({ file: shot }) => ({ file: shot, edits: load(editsFile(path.join(dir, shot))) }))
    .filter((s) => s.edits.length);
  if (!edits.length && !shots.length) {
    fs.rmSync(file, { force: true });
    return null;
  }
  fs.writeFileSync(file, editedRunbook(take, edits, shots, dir));
  return file;
}

function removeOutputs(files) {
  for (const file of [files.edits, files.edited, files.editedTimeline].filter(Boolean)) fs.rmSync(file, { force: true });
}

// The next number in the take's screenshot sequence. 99 is the full-page shot, which sits at the
// end on purpose and is not part of the sequence.
function nextShot(dir) {
  const numbers = fs.readdirSync(dir)
    .map((f) => /^(\d{2})-.*\.png$/.exec(f)?.[1])
    .filter(Boolean)
    .map(Number)
    .filter((n) => n < 99);
  return String(Math.max(0, ...numbers) + 1).padStart(2, '0');
}

// ---------- the command line ----------

const number = (flag, value) => {
  const parsed = Number(value);
  if (value == null || !Number.isFinite(parsed)) throw new Error(`${flag} takes a number of seconds, got "${value}".`);
  return parsed;
};

function parseArgs(argv) {
  const args = { request: {} };
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    // Bare, it asks a screenshot for what it was taken around; a video's steps all need a label
    if (a === '--step') args.request.step = argv[i + 1] != null && !argv[i + 1].startsWith('--') ? argv[++i] : '';
    else if (a === '--at') args.request.at = number(a, argv[++i]);
    else if (a === '--to') args.request.to = number(a, argv[++i]);
    else if (a === '--box') args.request.box = argv[++i];
    else if (a === '--start') args.request.start = number(a, argv[++i]);
    else if (a === '--end') args.request.end = number(a, argv[++i]);
    else if (a === '--help' || a === '-h') args.help = true;
    else rest.push(a);
  }
  [args.target, args.operation, args.value] = rest;
  return args;
}

// Re-render after the list changed, then keep the list: a render that fails leaves both as they were.
// The edited runbook follows every change to any list of the take, the video's or a screenshot's.
async function applyList({ source, take, files }, edits) {
  if (!edits.length) {
    removeOutputs(files);
    console.log(`No edits left: the edited ${files.shot ? 'screenshot is' : 'video and its timeline are'} removed.`);
    reportRunbook(writeEditedRunbook(take, files.dir));
    return;
  }
  if (files.shot) {
    const drawn = await renderShot(files, edits);
    save(files.edits, drawn);
    console.log(formatList(drawn, take));
    console.log('');
    console.log(`SHOT: ${files.edited}`);
    reportRunbook(writeEditedRunbook(take, files.dir));
    return;
  }
  const { edited, edits: drawn } = await render(source, take, edits, files);
  save(files.edits, drawn);
  console.log(formatList(drawn, take));
  console.log('');
  console.log(`VIDEO: ${files.edited}  (${edited.duration.toFixed(1)}s)`);
  reportRunbook(writeEditedRunbook(take, files.dir));
}

const reportRunbook = (file) => { if (file) console.log(`RUNBOOK: ${file}`); };

const addEdit = (toRequest) => async (target) => {
  const { take, files, args } = target;
  const edits = load(files.edits);
  const request = { ...args.request, ...toRequest(args) };
  const edit = files.shot ? resolveShot(request, take, files.shot) : resolve(request, take, edits);
  await applyList(target, append(edits, edit));
};

// Every operation, its usage, one line on what it does, and whether it applies to a screenshot.
// `--help` prints this table and the dispatcher runs it, so an operation cannot be offered without
// existing or exist without being offered.
const OPERATIONS = {
  speed: {
    usage: 'speed <factor>',
    about: 'play the whole video, or the target range, <factor> times as fast (0.5 is half)',
    run: addEdit((args) => ({ kind: 'speed', factor: args.value })),
  },
  cover: {
    usage: 'cover',
    shot: true,
    about: 'pixelate the target box, for the target range or the whole video',
    run: addEdit(() => ({ kind: 'cover' })),
  },
  highlight: {
    usage: 'highlight',
    shot: true,
    about: 'draw a rounded rectangle round the target box, for the target range or all of it',
    run: addEdit(() => ({ kind: 'highlight' })),
  },
  arrow: {
    usage: 'arrow',
    shot: true,
    about: 'draw an arrow pointing at the target box, with its highlight',
    run: addEdit(() => ({ kind: 'arrow' })),
  },
  cut: {
    usage: 'cut',
    about: 'remove the target range; the join shows a short held-frame transition',
    run: addEdit(() => ({ kind: 'cut' })),
  },
  trim: {
    usage: 'trim',
    about: 'remove everything before --start <s> and/or after --end <s> on the edited video',
    run: addEdit(() => ({ kind: 'trim' })),
  },
  still: {
    usage: 'still <seconds>',
    about: 'save that moment of the edited video as the next numbered screenshot',
    async run({ source: video, files, args }) {
      const at = number('still', args.value);
      const source = fs.existsSync(files.edited) ? files.edited : video;
      const length = durationOf(source);
      if (at < 0 || at >= length) throw new Error(`still takes a moment of the ${length.toFixed(1)}s video, got ${at}.`);
      const out = path.join(files.dir, `${nextShot(files.dir)}-still-${at}.png`);
      execFileSync('ffmpeg', ['-y', '-v', 'error', '-ss', String(at), '-i', source, '-frames:v', '1', out]);
      console.log(`SHOT: ${out}`);
    },
  },
  list: {
    usage: 'list',
    shot: true,
    about: 'print the edits applied so far, numbered',
    async run({ take, files }) {
      console.log(formatList(load(files.edits), take));
    },
  },
  undo: {
    usage: 'undo [n]',
    shot: true,
    about: 'drop the last edit, or edit n of the list',
    async run(target) {
      const { files, args } = target;
      const n = args.value == null ? undefined : Number(args.value);
      const { edits } = undo(load(files.edits), n);
      await applyList(target, edits);
    },
  },
  reset: {
    usage: 'reset',
    shot: true,
    about: 'drop every edit and delete the edited video or screenshot, and the edited runbook once no list has an edit',
    async run({ take, files }) {
      removeOutputs(files);
      console.log(`Every edit dropped; the ${files.shot ? 'screenshot' : 'recording'} is as it was taken.`);
      reportRunbook(writeEditedRunbook(take, files.dir));
    },
  },
};

const TARGETS = [
  ['--step "<mark label>"', "the box of the element that step acted on, and the time to the next step"],
  ['--at <s> --to <s>', 'a time range on the edited video, the one you watched'],
  ['--box x,y,w,h', 'a box in frame pixels, for something no step acted on'],
];

// On a screenshot there is no time, so only the box half of a target means anything
const SHOT_TARGETS = [
  ['--step', 'what the screenshot was taken around: its element, else that of the step open then'],
  ['--step "<mark label>"', "the box of the element that step acted on"],
  ['--box x,y,w,h', 'a box in the screenshot\'s pixels'],
];

// A video-only operation named on a screenshot is refused before anything is read or written
function operationFor(name, files) {
  const operation = OPERATIONS[name];
  if (!operation) {
    throw new Error(`Unknown operation "${name ?? ''}". The operations are: `
      + `${Object.keys(OPERATIONS).join(', ')} — see --help.`);
  }
  if (files.shot && !operation.shot) {
    throw new Error(`${name} is for the video: a screenshot is one moment and has no time to change. `
      + `On a screenshot the operations are: ${shotOperations().join(', ')}.`);
  }
  return operation;
}

const shotOperations = () => Object.keys(OPERATIONS).filter((name) => OPERATIONS[name].shot);

function helpText() {
  const column = (rows) => {
    const width = Math.max(...rows.map(([left]) => left.length)) + 2;
    return rows.map(([left, right]) => `  ${left.padEnd(width)}${right}`).join('\n');
  };
  return `Edit a finished take without recording it again.

  node edit.js <OUT_DIR>/<name>.mp4 <operation> [target] [options]
  node edit.js <OUT_DIR>/NN-<shot>.png <operation> [target]

Every run re-renders the whole list of edits from the untouched <name>.mp4 into <name>-edited.mp4,
or from the untouched NN-<shot>.png into NN-<shot>-edited.png. A screenshot keeps its own list.
<name>-edited-runbook.md describes the edited files, with every edit listed. The recording, its
screenshots and its runbook are never changed.

Operations:
${column(Object.values(OPERATIONS).map((o) => [o.usage, o.about]))}

Targets (combine them: --step with --box or --at/--to replaces that part of the step):
${column(TARGETS)}

On a screenshot: ${shotOperations().join(', ')}, with the marks finished rather than drawn on.
${column(SHOT_TARGETS)}`;
}

async function main(argv) {
  const args = parseArgs(argv);
  if (args.help || !args.target) {
    console.log(helpText());
    process.exit(args.help ? 0 : 1);
  }
  const target = openTarget(args.target);
  await operationFor(args.operation, target.files).run({ ...target, args });
}

if (require.main === module) {
  main(process.argv.slice(2)).catch((e) => {
    console.error(String((e && e.message) || e));
    process.exit(1);
  });
}

module.exports = {
  OPERATIONS, TARGETS, SHOT_TARGETS, helpText, parseArgs, planMarks, markImages, buildGraph, chooseSides, nextShot,
  openTarget, operationFor, editedRunbook,
};
