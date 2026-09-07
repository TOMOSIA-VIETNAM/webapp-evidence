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
  fmt, keyCaps, resolvePause, buildTimeline, buildHotkeySection, buildNoteSection,
  ignoreHints, runArtifacts, archivePreviousRun,
} = require('../src/skills/get-evidence/scripts/record');
const { DEFAULTS } = require('../src/skills/get-evidence/scripts/settings');

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
  assert.equal(resolvePause(undefined, PACE), PACE.afterClickMs);
  assert.equal(resolvePause('normal', PACE), PACE.afterClickMs);
  assert.equal(resolvePause('observe', PACE), PACE.afterClickObserveMs);
  assert.ok(PACE.afterClickQuickMs < PACE.afterClickMs);
  assert.ok(PACE.afterClickMs < PACE.afterClickObserveMs);
});

test('an explicit number of milliseconds is passed through untouched', () => {
  assert.equal(resolvePause(4200, PACE), 4200);
  assert.equal(resolvePause(0, PACE), 0);
});

test('an unknown pause level fails loudly instead of falling back to the default', () => {
  assert.throws(() => resolvePause('slow', PACE), /slow/);
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
