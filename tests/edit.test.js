// The command that renders a take's edit list. The graph and the drawing are checked as strings,
// without a video: a cover applied after the speed change, or a transition sped up with the
// footage, still renders — it is only wrong. One test does render, from a few seconds of ffmpeg's
// test pattern, because "the recording is never written to" is a claim about the disk.
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const {
  OPERATIONS, TARGETS, helpText, buildGraph, planMarks, chooseSides, nextShot, editedRunbook,
} = require('../src/skills/recording/scripts/edit');
const {
  append, resolve, resolveShot, editedVideo, save, load, formatList,
} = require('../src/skills/recording/scripts/edits');
const { renderRunbook } = require('../src/skills/recording/scripts/record');
const { svgFor } = require('../src/skills/recording/scripts/overlay');
const { JOIN } = require('../src/skills/recording/scripts/cuts');
const { DRAW } = require('../src/skills/recording/scripts/style');

const SCRIPT = path.join(__dirname, '../src/skills/recording/scripts/edit.js');
const FPS = 25;
const frame = { width: 1280, height: 800 };
const SAVE = { x: 300, y: 400, width: 80, height: 32 };
const TAKE = {
  trimAt: 1, removed: [], inserted: [], fades: [], duration: 30, frame,
  marks: [
    { at: 2, label: 'Open the form', box: null },
    { at: 6, label: 'Fill in the email', box: { x: 40, y: 60, width: 200, height: 30 } },
    { at: 12, label: 'Save', box: SAVE },
  ],
};
// What a take's timeline holds besides its marks, so a runbook can be rendered from it
const RECORDED = (dir) => ({
  name: 'take', app: 'demo', baseUrl: 'http://localhost:3000', start: '/', configFile: null,
  stepsFile: path.join(dir, 'steps.js'), video: path.join(dir, 'take.mp4'), outDir: dir,
  runner: path.join(dir, 'record.js'), recordedAt: '2026-10-08T00:00:00.000Z', captions: 'en', capture: 'page',
  hotkeys: [], notes: [], commands: [], dialogs: [], covered: [], screenshots: [], fixes: [], problems: [],
});
const build = (take, requests) => requests.reduce((edits, r) => append(edits, resolve(r, take, edits)), []);
const fakeFiles = (marks) => marks.map((m, i) => ({ ...m, files: { drawing: `m${i}/%03d.png`, finished: `m${i}.png` } }));

// ---------- the graph ----------

test('covers come before the cut and the speed change, marks after them', () => {
  const edits = build(TAKE, [
    { kind: 'speed', factor: 2 },
    { kind: 'cover', step: 'Fill in the email' },
    { kind: 'arrow', step: 'Save' },
    { kind: 'cut', at: 3, to: 4 },
  ]);
  const marks = fakeFiles(planMarks(editedVideo(TAKE, edits), edits, FPS));
  const { graph, inputs } = buildGraph({ take: TAKE, edits, fps: FPS, marks });
  const steps = graph.split(';');
  const at = (pattern) => steps.findIndex((s) => pattern.test(s));
  const cover = at(/flags=neighbor/);
  const cut = at(/tpad=/);
  const speed = at(/setpts=\(PTS-STARTPTS\)\/2/);
  const mark = at(/\[1:v\]setpts/);
  assert.ok(cover >= 0 && cut > cover && speed > cut && mark > speed, graph);
  // The mark reads its drawing and its finished image, both inputs of the encode
  assert.deepEqual(inputs.filter((a) => a.endsWith('.png')), ['m0/%03d.png', 'm0.png']);
});

test('speed leaves the held frames of a join at their own length', () => {
  const edits = build(TAKE, [{ kind: 'cut', at: 5, to: 10 }, { kind: 'speed', factor: 2 }]);
  const { graph } = buildGraph({ take: TAKE, edits, fps: FPS });
  const pieces = [...graph.matchAll(/trim=start=([\d.]+)(?::end=([\d.]+))?,setpts=\(PTS-STARTPTS\)(\/[\d.]+)?/g)]
    .map(([, from, to, rate]) => ({ length: to ? Number((to - from).toFixed(3)) : Infinity, rate }));
  assert.deepEqual(pieces.map((p) => p.rate), ['/2', undefined, '/2']);
  assert.equal(pieces[1].length, JOIN);
});

test('with no speed change there is no speed stage', () => {
  const edits = build(TAKE, [{ kind: 'cut', at: 5, to: 10 }]);
  assert.doesNotMatch(buildGraph({ take: TAKE, edits, fps: FPS }).graph, /fps=/);
});

test('a mark starts on a frame of the edited video and is drawn one image per frame', () => {
  const edits = build(TAKE, [{ kind: 'speed', factor: 2 }, { kind: 'highlight', step: 'Save' }]);
  const [mark] = planMarks(editedVideo(TAKE, edits), edits, FPS);
  // Save is take 12, recorded 11, 5.5 at 2x — moved onto the nearest frame of a 25fps video
  assert.equal(mark.from, Math.round(5.5 * FPS) / FPS);
  assert.equal(mark.frames, Math.ceil(DRAW.outline * FPS));
  // A mark the cuts took out entirely is not drawn
  const gone = build(TAKE, [{ kind: 'highlight', at: 10, to: 12, box: '0,0,10,10' }, { kind: 'cut', at: 9, to: 13 }]);
  assert.deepEqual(planMarks(editedVideo(TAKE, gone), gone, FPS), []);
});

// ---------- the drawing ----------

const attrs = (svg, tag) => [...svg.matchAll(new RegExp(`<${tag} ([^>]*)/>`, 'g'))]
  .map(([, body]) => Object.fromEntries([...body.matchAll(/([\w-]+)="([^"]*)"/g)].map(([, k, v]) => [k, v])));
const length = ({ x1, y1, x2, y2 }) => Math.hypot(x2 - x1, y2 - y1);

test('a highlight traces itself: the whole outline hidden at 0, half at 0.5, plain at 1', () => {
  const at = (progress) => attrs(svgFor({ kind: 'highlight', box: SAVE, frame, progress }), 'rect');
  assert.deepEqual(at(0).map((r) => r['stroke-dashoffset']), ['100', '100']);
  assert.deepEqual(at(0.5).map((r) => r['stroke-dashoffset']), ['50', '50']);
  assert.ok(at(1).every((r) => !('stroke-dashoffset' in r)));
});

test('an arrow traces its highlight, then grows its shaft, and lands its head only at the end', () => {
  const at = (progress) => svgFor({ kind: 'arrow', box: SAVE, frame, progress });
  const share = DRAW.outline / (DRAW.outline + DRAW.shaft);
  // At 0 nothing but the hidden outline
  assert.equal(attrs(at(0), 'line').length, 0);
  assert.equal(attrs(at(0), 'polygon').length, 0);
  // Halfway through the shaft's share the shaft is half its finished length, with no head
  const full = attrs(at(1), 'line').at(-1);
  const half = attrs(at(share + (1 - share) / 2), 'line').at(-1);
  assert.equal(attrs(at(share + (1 - share) / 2), 'polygon').length, 0);
  assert.equal(half.x1, full.x1);
  assert.ok(Math.abs(length(half) - length(full) / 2) < 0.1);
  // The outline is drawn in full before the shaft starts
  assert.ok(attrs(at(share), 'rect').every((r) => !('stroke-dashoffset' in r)));
  assert.ok(attrs(at(1), 'polygon').length > 0);
  assert.equal(at(1), svgFor({ kind: 'arrow', box: SAVE, frame }));
});

// ---------- the command line ----------

test('--help lists every operation the command runs, and every target', () => {
  const help = helpText();
  for (const [name, op] of Object.entries(OPERATIONS)) {
    assert.ok(op.usage.split(' ')[0] === name, `${name}'s usage starts with another name`);
    assert.match(help, new RegExp(`^  ${op.usage.replace(/[[\]]/g, '\\$&')}\\s`, 'm'));
  }
  for (const [flag] of TARGETS) assert.ok(help.includes(flag), flag);
});

test('a still is numbered after the take\'s screenshots, never as the full-page one', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'evidence-edit-'));
  for (const f of ['01-start.png', '07-done.png', '99-full-page.png']) fs.writeFileSync(path.join(dir, f), '');
  assert.equal(nextShot(dir), '08');
});

// ---------- the disk ----------

const hash = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

test('edits render to the edited video and never write to what was recorded', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'evidence-edit-'));
  const video = path.join(dir, 'take.mp4');
  execFileSync('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', `testsrc=size=320x200:rate=${FPS}:duration=4`,
    '-pix_fmt', 'yuv420p', video]);
  const take = {
    ...RECORDED(dir), trimAt: 0, removed: [], inserted: [], fades: [], duration: 4, frame: { width: 320, height: 200 }, marks: [],
  };
  fs.writeFileSync(path.join(dir, 'take-timeline.json'), JSON.stringify(take));
  fs.writeFileSync(path.join(dir, 'take-runbook.md'), '# runbook\n');
  fs.writeFileSync(path.join(dir, '01-shot.png'), 'png');
  const originals = ['take.mp4', 'take-runbook.md', '01-shot.png', 'take-timeline.json'].map((f) => path.join(dir, f));
  const before = originals.map(hash);

  const edit = (...args) => execFileSync('node', [SCRIPT, video, ...args], { encoding: 'utf8' });
  edit('cover', '--box', '10,10,100,50', '--at', '0', '--to', '2');
  edit('cut', '--at', '1', '--to', '2');
  edit('speed', '2');

  const edited = JSON.parse(fs.readFileSync(path.join(dir, 'take-edited-timeline.json'), 'utf8'));
  assert.equal(edited.duration, (4 - 1) / 2 + JOIN);
  const probed = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration',
    '-of', 'csv=p=0', path.join(dir, 'take-edited.mp4')], { encoding: 'utf8' }));
  assert.ok(Math.abs(probed - edited.duration) <= 2 / FPS, `${probed} against ${edited.duration}`);
  assert.equal(edited.fades.length, 1);
  assert.deepEqual(originals.map(hash), before);
  const runbook = path.join(dir, 'take-edited-runbook.md');
  assert.match(fs.readFileSync(runbook, 'utf8'), new RegExp(`^duration_seconds: ${edited.duration.toFixed(1)}$`, 'm'));

  edit('reset');
  assert.ok(!fs.existsSync(path.join(dir, 'take-edited.mp4')));
  assert.ok(!fs.existsSync(path.join(dir, 'take-edits.json')));
  assert.ok(!fs.existsSync(runbook));
  assert.deepEqual(originals.map(hash), before);
});

test('an arrow is placed on the frame it starts on, after the cuts, away from the detail there', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'evidence-edit-'));
  const video = path.join(dir, 'take.mp4');
  // A plain grey page; from 2s of the recording on, a busy test pattern sits right of the box the
  // arrow points at. Times in the edits are on the edited video: 3.5 there is 2.6 recorded, after
  // the cut and its held frames.
  execFileSync('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', `color=gray:size=640x400:rate=${FPS}:duration=4`,
    '-f', 'lavfi', '-i', `testsrc=size=200x120:rate=${FPS}:duration=4`,
    '-filter_complex', "[0][1]overlay=240:130:enable='gte(t,2)'", '-pix_fmt', 'yuv420p', video]);
  const take = { trimAt: 0, removed: [], inserted: [], fades: [], duration: 4, frame: { width: 640, height: 400 }, marks: [] };
  const sides = (edits) => chooseSides(video, take, edits, FPS, planMarks(editedVideo(take, edits), edits, FPS))
    .map((m) => m.side);
  assert.deepEqual(sides(build(take, [{ kind: 'arrow', box: '150,180,60,30', at: 0.5, to: 1.5 }])), ['right']);
  assert.deepEqual(sides(build(take, [
    { kind: 'cut', at: 1, to: 1.5 },
    { kind: 'arrow', box: '150,180,60,30', at: 3.5, to: 4.5 },
    { kind: 'highlight', box: '150,180,60,30', at: 0, to: 1 },
  ])), ['left', undefined]);
});

// ---------- the edited runbook ----------

// A take whose steps start on whole even seconds of the recorded video, so halving them is exact
const RUNBOOK_TAKE = {
  ...RECORDED('/project/out'), ...TAKE,
  marks: [
    { at: 3, label: 'Open the form', box: null },
    { at: 7, label: 'Fill in the email', box: { x: 40, y: 60, width: 200, height: 30 } },
    { at: 9, label: 'Wait for the check', box: null },
    { at: 13, label: 'Save', box: SAVE },
    { at: 17, label: 'Read the result', box: null },
  ],
  screenshots: [{ at: 14, file: '01-saved.png', box: SAVE }, { at: null, file: '99-full-page.png', box: null }],
};
// The step rows of a runbook, start in seconds by label
const stepRows = (runbook) => Object.fromEntries([...runbook.matchAll(/^(\d\d):(\d\d) - \d\d:\d\d {2}(.+)$/gm)]
  .map(([, mm, ss, label]) => [label, 60 * Number(mm) + Number(ss)]));

test('the edited runbook at 2x puts every step at half the time it has in the recording', () => {
  const recorded = stepRows(renderRunbook(RUNBOOK_TAKE));
  const edits = build(RUNBOOK_TAKE, [{ kind: 'speed', factor: 2 }]);
  const runbook = editedRunbook(RUNBOOK_TAKE, edits, [], '/project/out');
  const edited = stepRows(runbook);
  assert.deepEqual(Object.keys(edited), Object.keys(recorded));
  for (const label of Object.keys(recorded)) assert.equal(edited[label], recorded[label] / 2, label);
  // Recorded 30s, so 15s at 2x
  assert.match(runbook, /^duration_seconds: 15\.0$/m);
  assert.match(runbook, /^video: .*take-edited\.mp4$/m);
});

test('the edited runbook drops the steps inside a cut and moves later ones by the cut less the join', () => {
  const recorded = stepRows(renderRunbook(RUNBOOK_TAKE));
  // Recorded 7 to 11: "Wait for the check" (recorded 8) is inside it
  const edits = build(RUNBOOK_TAKE, [{ kind: 'cut', at: 7, to: 11 }]);
  const edited = stepRows(editedRunbook(RUNBOOK_TAKE, edits, [], '/project/out'));
  assert.ok(!('Wait for the check' in edited));
  assert.equal(edited['Open the form'], recorded['Open the form']);
  assert.equal(edited['Fill in the email'], recorded['Fill in the email']);
  for (const label of ['Save', 'Read the result']) {
    assert.equal(edited[label], Math.floor(recorded[label] - 4 + JOIN), label);
  }
});

test('the edited runbook lists every edit, the video\'s and each screenshot\'s, and names the edited files', () => {
  const edits = build(RUNBOOK_TAKE, [
    { kind: 'speed', factor: 2 },
    { kind: 'cut', at: 3.5, to: 4.5 },
    { kind: 'arrow', step: 'Save' },
    { kind: 'cover', step: 'Fill in the email' },
  ]);
  const shot = [resolveShot({ kind: 'highlight', step: '' }, RUNBOOK_TAKE, '01-saved.png')];
  const runbook = editedRunbook(RUNBOOK_TAKE, edits, [{ file: '01-saved.png', edits: shot }], '/project/out');
  for (const line of [...formatList(edits, RUNBOOK_TAKE).split('\n'), formatList(shot, RUNBOOK_TAKE)]) {
    assert.ok(runbook.includes(line), line);
  }
  assert.equal(edits.length + shot.length, [...runbook.matchAll(/^\d+\. (speed|cut|arrow|cover|highlight) /gm)].length);
  // The screenshot with edits is listed by its edited file; the one without, as taken
  assert.match(runbook, /^- 01-saved-edited\.png$/m);
  assert.match(runbook, /^- 99-full-page\.png$/m);
});

// ---------- a screenshot ----------

test('a screenshot keeps an edit list of its own, and refuses what only a video has', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'evidence-edit-'));
  const video = path.join(dir, 'take.mp4');
  const shot = path.join(dir, '01-saved.png');
  fs.writeFileSync(video, '');
  fs.writeFileSync(shot, 'png');
  fs.writeFileSync(path.join(dir, 'take-timeline.json'), JSON.stringify({
    ...TAKE, screenshots: [{ at: 13, file: '01-saved.png', box: null }],
  }));
  const videoEdits = build(TAKE, [{ kind: 'speed', factor: 2 }]);
  save(path.join(dir, 'take-edits.json'), videoEdits);

  const run = (...args) => {
    try {
      return { status: 0, out: execFileSync('node', [SCRIPT, ...args], { encoding: 'utf8', stdio: 'pipe' }) };
    } catch (e) {
      return { status: e.status, out: `${e.stdout}${e.stderr}` };
    }
  };
  // The video's list is not the screenshot's
  assert.match(run(shot, 'list').out, /^No edits yet\.$/m);
  assert.match(run(video, 'list').out, /^1\. speed 2x/m);

  // Every operation without a meaning on one moment is refused, as is a time range for one that has
  for (const args of [['speed', '2'], ['cut', '--at', '1', '--to', '2'], ['trim', '--start', '1'], ['still', '1'],
    ['highlight', '--step', 'Save', '--at', '1', '--to', '2']]) {
    assert.notEqual(run(shot, ...args).status, 0, args.join(' '));
  }
  assert.ok(!fs.existsSync(path.join(dir, '01-saved-edits.json')));
  assert.ok(!fs.existsSync(path.join(dir, '01-saved-edited.png')));
  assert.deepEqual(load(path.join(dir, 'take-edits.json')), videoEdits);
});

test('--step on a screenshot is what it was taken around, or the step open when it was taken', () => {
  const take = {
    ...TAKE,
    screenshots: [
      { at: 13, file: '01-saved.png', box: null },
      { at: 7, file: '02-form.png', box: { x: 5, y: 5, width: 50, height: 20 } },
      { at: null, file: '99-full-page.png', box: null },
    ],
  };
  assert.deepEqual(resolveShot({ kind: 'arrow', step: '' }, take, '01-saved.png'), { kind: 'arrow', box: SAVE, step: 'Save' });
  assert.deepEqual(resolveShot({ kind: 'cover', step: '' }, take, '02-form.png').box, { x: 5, y: 5, width: 50, height: 20 });
  // A label names that step, whichever was open
  assert.deepEqual(resolveShot({ kind: 'highlight', step: 'Fill in the email' }, take, '01-saved.png').box, TAKE.marks[1].box);
  assert.throws(() => resolveShot({ kind: 'highlight', step: '' }, take, '99-full-page.png'));
  // A window take: the frame holds the browser's chrome above the page, at twice the page's scale
  const window = { ...take, pageInFrame: { x: 0, y: 80, scale: 2 } };
  assert.deepEqual(resolveShot({ kind: 'arrow', step: '' }, window, '01-saved.png').box, { ...SAVE, y: SAVE.y - 160 });
  // --box is already in the screenshot's pixels
  assert.deepEqual(resolveShot({ kind: 'cover', box: '1,2,3,4' }, window, '01-saved.png').box, { x: 1, y: 2, width: 3, height: 4 });
});
