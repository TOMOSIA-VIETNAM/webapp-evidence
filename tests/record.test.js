// The runner's browser work needs a real page, but the decisions around it do not: what a
// pause level costs, which rows reach the timeline, which files count as a previous take, and
// which .gitignore line to hand the user. Those are the parts that quietly break during a
// refactor, so they are covered here without launching anything.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// session.js refuses to run from inside the skill directory, and this repository IS that
// directory. Point it at a scratch project before the module is loaded.
const PROJECT = fs.mkdtempSync(path.join(os.tmpdir(), 'evidence-record-'));
process.env.PROJECT_ROOT = PROJECT;

const {
  fmt, keyCaps, resolvePause, readingTime, buildTimeline, buildHotkeySection, buildNoteSection,
  buildCommandSection, buildRedactionSection, buildRemovedSection, placeAt,
  ignoreHints, runArtifacts, archivePreviousRun,
} = require('../src/skills/recording/scripts/record');
const { DEFAULTS } = require('../src/skills/recording/scripts/settings');

const PACE = DEFAULTS.recording.pace;

function outDir(files = []) {
  const dir = fs.mkdtempSync(path.join(PROJECT, 'out-'));
  files.forEach((f) => fs.writeFileSync(path.join(dir, f), f));
  return dir;
}

test('timestamps are mm:ss, zero padded, and roll over at a minute', () => {
  assert.equal(fmt(0), '00:00');
  assert.equal(fmt(9.7), '00:09');
  assert.equal(fmt(61), '01:01');
  assert.equal(fmt(600), '10:00');
});

test('key captions follow the operating system doing the recording', () => {
  const [modifier, letter] = keyCaps('ControlOrMeta+C');
  assert.equal(letter, 'C');
  assert.equal(modifier, process.platform === 'darwin' ? '⌘' : 'Ctrl');
  assert.deepEqual(keyCaps('Escape'), ['Esc']);
  assert.deepEqual(keyCaps('Shift+Tab'), [process.platform === 'darwin' ? '⇧' : 'Shift', 'Tab']);
  assert.deepEqual(keyCaps('ArrowDown'), ['↓']);
  assert.deepEqual(keyCaps('c'), ['C']);
});

test('an empty segment in a hotkey string is rejected rather than drawn as a blank cap', () => {
  assert.throws(() => keyCaps('Control+'), /Control/);
});

test('pause levels map to the configured durations, shortest to longest', () => {
  assert.equal(resolvePause('quick', PACE), PACE.afterClickQuickMs);
  assert.equal(resolvePause('normal', PACE), PACE.afterClickMs);
  assert.equal(resolvePause('observe', PACE), PACE.afterClickObserveMs);
  assert.ok(PACE.afterClickQuickMs < PACE.afterClickMs);
  assert.ok(PACE.afterClickMs < PACE.afterClickObserveMs);
});

test('with no level given, the caller decides what the default is', () => {
  // A click and a command finishing are not the same beat, so the fallback belongs to whichever
  // helper is asking rather than being baked into the vocabulary they share.
  assert.equal(resolvePause(undefined, PACE, PACE.afterClickMs), PACE.afterClickMs);
  assert.equal(resolvePause(undefined, PACE, PACE.afterCommandMs), PACE.afterCommandMs);
});

test('an explicit number of milliseconds is passed through untouched', () => {
  assert.equal(resolvePause(4200, PACE), 4200);
  assert.equal(resolvePause(0, PACE), 0);
});

test('an unknown pause level fails loudly instead of falling back to the default', () => {
  assert.throws(() => resolvePause('slow', PACE), /slow/);
});

test('a caption stays up in proportion to how much there is to read', () => {
  const short = readingTime('Chosen.', PACE);
  const long = readingTime(
    'Selected "Price (low to high)". The dropdown menu is drawn by the operating system, '
    + 'so it does not appear in this recording.', PACE,
  );
  assert.ok(long > short, `${long} is not longer than ${short}`);
});

test('no caption holds the take long enough to be read twice', () => {
  // It is a hint, not the evidence, and it is paid for in how long the video runs and how
  // large the file is. Anyone who wants every word of a long one pauses.
  const longest = readingTime('x'.repeat(500), PACE);
  assert.ok(longest <= 3500, `a caption can hold the take for ${longest}ms`);
});

test('even the shortest caption is shown long enough to notice', () => {
  assert.ok(readingTime('', PACE) >= PACE.noteHoldMs);
  assert.ok(readingTime('OK', PACE) >= PACE.noteHoldMs);
});

test('no caption can stall the take, however long the sentence', () => {
  const essay = readingTime('x'.repeat(2000), PACE);
  assert.equal(essay, PACE.noteHoldMaxMs);
});

test('a Japanese caption gets more time per character than an English one', () => {
  // 31 Japanese characters say about as much as a long English sentence, and take as long to read.
  const japanese = readingTime('この行はシードデータで、この操作で作られたものではありません。', PACE);
  const english = readingTime('x'.repeat(31), PACE);
  assert.ok(japanese > english, `${japanese} is not longer than ${english} for the same length`);
});

test('timeline rows are rebased on the trim point and run to the next mark', () => {
  const marks = [
    { at: 3, label: 'Open the list' },
    { at: 13, label: 'Filter' },
  ];
  const rows = buildTimeline(marks, 3, 20).split('\n');
  assert.equal(rows.length, 2);
  assert.match(rows[0], /^00:00 - 00:10 {2}Open the list$/);
  assert.match(rows[1], /^00:10 - 00:20 {2}Filter$/);
});

test('a mark that barely lasts is left out: the reader cannot seek to it anyway', () => {
  const marks = [
    { at: 0, label: 'Blink' },
    { at: 0.2, label: 'Real step' },
  ];
  assert.equal(buildTimeline(marks, 0, 10), '00:00 - 00:10  Real step');
});

test('a recording with no marks yields an empty timeline instead of a stray row', () => {
  assert.equal(buildTimeline([], 0, 10), '');
});

test('the hotkey and caption sections only appear when there is something to list', () => {
  assert.equal(buildHotkeySection([], 0), '');
  assert.equal(buildNoteSection([], 0), '');

  const hotkeys = buildHotkeySection([{ at: 7, keys: 'ControlOrMeta+C', label: 'Copy' }], 2);
  assert.match(hotkeys, /00:05/);
  assert.match(hotkeys, /ControlOrMeta\+C/);
  assert.match(hotkeys, /Copy/);

  const notes = buildNoteSection([{ at: 9, text: 'Seeded row, not created by this flow' }], 2);
  assert.match(notes, /00:07/);
  assert.match(notes, /Seeded row/);
});

test('timestamps never go negative when something happened before the trim point', () => {
  assert.match(buildHotkeySection([{ at: 1, keys: 'Escape' }], 5), /00:00/);
  assert.match(buildNoteSection([{ at: 1, text: 'Early note' }], 5), /00:00/);
});

test('the .gitignore hint covers the exact directory, plus a pattern for later issues', () => {
  const hints = ignoreHints('/repo/backlogs/1599/evidence/pr1606', '/repo');
  assert.equal(hints[0], 'backlogs/1599/evidence/pr1606/');
  assert.ok(hints.includes('backlogs/**/evidence/'));
});

test('a path with no evidence directory to generalise gets the exact line only', () => {
  assert.deepEqual(ignoreHints('/repo/notebooks/shots', '/repo'), ['notebooks/shots/']);
});

test('previous run artifacts are recognised, project files are not', () => {
  const dir = outDir([
    '01-list.png', '99-full-page.png', 'user-search.mp4', 'user-search-runbook.md',
    'user-search-console.log', 'steps.js', 'sample.csv', 'evidence.config.js', 'notes.md',
  ]);
  const found = runArtifacts(dir, 'user-search').sort();
  assert.deepEqual(found, [
    '01-list.png', '99-full-page.png', 'user-search-console.log',
    'user-search-runbook.md', 'user-search.mp4',
  ]);
});

test('what a crashed run left behind counts as a previous take, not as a project file', () => {
  // Both are large, and both are only ever there because a run died before the encode read them
  const dir = outDir(['user-search.webm', 'user-search.raw.mp4', 'steps.js']);
  assert.deepEqual(runArtifacts(dir, 'user-search').sort(), ['user-search.raw.mp4', 'user-search.webm']);
});

test('artifacts of a differently named recording are left alone', () => {
  const dir = outDir(['other-flow.mp4', 'user-search.mp4']);
  assert.deepEqual(runArtifacts(dir, 'user-search'), ['user-search.mp4']);
});

test('a previous take is archived into v1, and the script stays put', () => {
  const dir = outDir(['01-list.png', 'user-search.mp4', 'steps.js']);
  const archive = archivePreviousRun(dir, 'user-search', false);

  assert.equal(path.basename(archive), 'v1');
  assert.deepEqual(fs.readdirSync(archive).sort(), ['01-list.png', 'user-search.mp4']);
  assert.deepEqual(fs.readdirSync(dir).sort(), ['steps.js', 'v1']);
});

test('each archive run takes the next version number, never overwriting an older one', () => {
  const dir = outDir(['user-search.mp4']);
  archivePreviousRun(dir, 'user-search', false);
  fs.writeFileSync(path.join(dir, 'user-search.mp4'), 'take 2');
  const second = archivePreviousRun(dir, 'user-search', false);

  assert.equal(path.basename(second), 'v2');
  assert.equal(fs.readFileSync(path.join(second, 'user-search.mp4'), 'utf8'), 'take 2');
});

test('overwrite deletes the previous take instead of archiving it', () => {
  const dir = outDir(['01-list.png', 'user-search.mp4', 'steps.js']);
  assert.equal(archivePreviousRun(dir, 'user-search', true), null);
  assert.deepEqual(fs.readdirSync(dir), ['steps.js']);
});

test('a first run has nothing to archive', () => {
  const dir = outDir(['steps.js']);
  assert.equal(archivePreviousRun(dir, 'user-search', false), null);
  assert.deepEqual(fs.readdirSync(dir), ['steps.js']);
});

test.after(() => fs.rmSync(PROJECT, { recursive: true, force: true }));

// ---------- the commands section of the runbook ----------

test('a take that never opened the terminal adds no section to the runbook', () => {
  assert.equal(buildCommandSection([], 0), '');
});

test('each kind of terminal step says what became of it', () => {
  const section = buildCommandSection([
    { at: 5, kind: 'run', text: 'bin/rails db:seed', exitCode: 0 },
    { at: 9, kind: 'start', text: 'tail -f log/worker.log' },
    { at: 14, kind: 'wait', text: '/SyncJob .* finished/', matched: 'SyncJob 12 finished' },
    { at: 18, kind: 'interrupt', text: 'tail -f log/worker.log' },
    { at: 22, kind: 'run', text: 'ls tmp/exports', exitCode: 2 },
  ], 2);

  assert.match(section, /exit 0/);
  assert.match(section, /started, left running/);
  assert.match(section, /interrupted/);
  assert.match(section, /exit 2/);
  // The waitFor row is the assertion the take rests on, so it carries what actually matched
  assert.match(section, /SyncJob 12 finished/);
});

test('command timestamps are relative to the trimmed start, like every other section', () => {
  const section = buildCommandSection([{ at: 65, kind: 'run', text: 'true', exitCode: 0 }], 5);
  assert.match(section, /01:00/);
});

// ---------- what a removed stretch does to every other section ----------

const CUT = [{ from: 10, to: 20 }];   // ten seconds taken out, in finished-video time

test('a moment before a cut keeps its place, and one after it moves up', () => {
  assert.equal(placeAt(5, 0, CUT), 5);
  assert.equal(placeAt(25, 0, CUT), 15);
});

test('a moment inside a cut has nowhere to point', () => {
  assert.equal(placeAt(12, 0, CUT), null);
});

test('the timeline drops a mark that was cut and renumbers the rest', () => {
  const marks = [
    { at: 2, label: 'Before' },
    { at: 12, label: 'Cut out' },
    { at: 25, label: 'After' },
  ];
  const rows = buildTimeline(marks, 0, 30, CUT).split('\n');
  assert.equal(rows.length, 2);
  assert.match(rows[0], /^00:02 - 00:15 {2}Before$/);
  assert.match(rows[1], /^00:15 - 00:30 {2}After$/);
});

test('hotkeys, captions and commands are renumbered the same way', () => {
  assert.match(buildHotkeySection([{ at: 25, keys: 'Escape' }], 0, CUT), /00:15/);
  assert.match(buildNoteSection([{ at: 25, text: 'Later' }], 0, CUT), /00:15/);
  assert.match(
    buildCommandSection([{ at: 25, kind: 'run', text: 'true', exitCode: 0 }], 0, CUT),
    /00:15/,
  );
});

test('a row that fell inside a cut is dropped rather than pointing at the wrong second', () => {
  assert.equal(buildHotkeySection([{ at: 12, keys: 'Escape' }], 0, CUT), '');
  assert.equal(buildNoteSection([{ at: 12, text: 'Gone' }], 0, CUT), '');
  assert.equal(buildCommandSection([{ at: 12, kind: 'run', text: 'true', exitCode: 0 }], 0, CUT), '');
});

// ---------- what the runbook says about the redactions ----------

test('a take with nothing covered gains no sections', () => {
  assert.equal(buildRedactionSection([], 0, []), '');
  assert.equal(buildRemovedSection([]), '');
});

test('a covered region is listed with when and where, so it does not read as a rendering fault', () => {
  const section = buildRedactionSection(
    [{ mode: 'box', box: { x: 40, y: 318, width: 200, height: 24 }, from: 12, to: 17 }], 2, [],
  );
  assert.match(section, /00:10 - 00:15/);
  assert.match(section, /solid block/);
  assert.match(section, /200x24 at 40,318/);
});

test('a blurred whole frame says so instead of printing a rectangle', () => {
  const section = buildRedactionSection([{ mode: 'blur', box: null, from: 1, to: 2 }], 0, []);
  assert.match(section, /blurred/);
  assert.match(section, /whole frame/);
});

test('a removed stretch is not listed as covered — it is not in the video to point at', () => {
  assert.equal(buildRedactionSection([{ mode: 'cut', box: null, from: 1, to: 4 }], 0, []), '');
});

test('the reader is told the video is shorter than what was recorded', () => {
  const section = buildRemovedSection([{ from: 3, to: 6 }, { from: 10, to: 12 }]);
  assert.match(section, /2 stretches/);
  assert.match(section, /5\.0s/);
});
