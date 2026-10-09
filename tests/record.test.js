// The runner's browser work needs a real page, but the decisions around it do not: what a
// pause level costs, which rows reach the timeline, which files count as a previous take, and
// which .gitignore line to hand the user. Those are the parts that quietly break during a
// refactor, so they are covered here without launching anything.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

// session.js refuses to run from inside the skill directory, and this repository IS that
// directory. Point it at a scratch project before the module is loaded.
const PROJECT = fs.mkdtempSync(path.join(os.tmpdir(), 'evidence-record-'));
process.env.PROJECT_ROOT = PROJECT;

const {
  fmt, keyCaps, resolvePause, readingTime, buildTimeline, buildHotkeySection, buildNoteSection,
  buildCommandSection, buildRemovedSection, placeAt, runCaseDisposers,
  ignoreHints, runArtifacts, archivePreviousRun, failedTakeError, takeRemap, renderRunbook,
} = require('../src/skills/recording/scripts/record');
const { DEFAULTS } = require('../src/skills/recording/scripts/settings');
const { buildFilter } = require('../src/skills/recording/scripts/cuts');

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
  const rows = buildTimeline(marks, takeRemap(3), 20).split('\n');
  assert.equal(rows.length, 2);
  assert.match(rows[0], /^00:00 - 00:10 {2}Open the list$/);
  assert.match(rows[1], /^00:10 - 00:20 {2}Filter$/);
});

test('a mark that barely lasts is left out: the reader cannot seek to it anyway', () => {
  const marks = [
    { at: 0, label: 'Blink' },
    { at: 0.2, label: 'Real step' },
  ];
  assert.equal(buildTimeline(marks, takeRemap(0), 10), '00:00 - 00:10  Real step');
});

test('a recording with no marks yields an empty timeline instead of a stray row', () => {
  assert.equal(buildTimeline([], takeRemap(0), 10), '');
});

test('a step that starts where a cut does is cut with it, not left a row the length of the hold', () => {
  const marks = [{ at: 0, label: 'Before' }, { at: 10, label: 'Cut whole' }, { at: 20, label: 'After' }];
  const remap = takeRemap(0, [{ from: 10, to: 20 }], [{ at: 20, duration: 1.4 }]);
  const rows = buildTimeline(marks, remap, 30).split('\n');
  assert.deepEqual(rows.map((row) => row.split('  ')[1]), ['Before', 'After']);
});


test('the hotkey and caption sections only appear when there is something to list', () => {
  assert.equal(buildHotkeySection([], takeRemap(0)), '');
  assert.equal(buildNoteSection([], takeRemap(0)), '');

  const hotkeys = buildHotkeySection([{ at: 7, keys: 'ControlOrMeta+C', label: 'Copy' }], takeRemap(2));
  assert.match(hotkeys, /00:05/);
  assert.match(hotkeys, /ControlOrMeta\+C/);
  assert.match(hotkeys, /Copy/);

  const notes = buildNoteSection([{ at: 9, text: 'Seeded row, not created by this flow' }], takeRemap(2));
  assert.match(notes, /00:07/);
  assert.match(notes, /Seeded row/);
});

test('timestamps never go negative when something happened before the trim point', () => {
  assert.match(buildHotkeySection([{ at: 1, keys: 'Escape' }], takeRemap(5)), /00:00/);
  assert.match(buildNoteSection([{ at: 1, text: 'Early note' }], takeRemap(5)), /00:00/);
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
    'user-search-timeline.json', 'user-search-console.log', 'steps.js', 'sample.csv', 'evidence.config.js', 'notes.md',
  ]);
  const found = runArtifacts(dir, 'user-search').sort();
  assert.deepEqual(found, [
    '01-list.png', '99-full-page.png', 'user-search-console.log',
    'user-search-runbook.md', 'user-search-timeline.json', 'user-search.mp4',
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
  assert.equal(buildCommandSection([], takeRemap(0)), '');
});

test('each kind of terminal step says what became of it', () => {
  const section = buildCommandSection([
    { at: 5, kind: 'run', text: 'bin/rails db:seed', exitCode: 0 },
    { at: 9, kind: 'start', text: 'tail -f log/worker.log' },
    { at: 14, kind: 'wait', text: '/SyncJob .* finished/', matched: 'SyncJob 12 finished' },
    { at: 18, kind: 'interrupt', text: 'tail -f log/worker.log' },
    { at: 22, kind: 'run', text: 'ls tmp/exports', exitCode: 2 },
  ], takeRemap(2));

  assert.match(section, /exit 0/);
  assert.match(section, /started, left running/);
  assert.match(section, /interrupted/);
  assert.match(section, /exit 2/);
  // The waitFor row is the assertion the take rests on, so it carries what actually matched
  assert.match(section, /SyncJob 12 finished/);
});

test('a command run to prove something carries what it asserted, not only that it ran', () => {
  const section = buildCommandSection([
    { at: 5, kind: 'run', text: 'curl -sS "https://app/api/orders"', exitCode: 0, asserted: 'asserted HTTP 201' },
  ], takeRemap(0));

  // The runbook is read without the video beside it, so a row saying a request was made and
  // nothing about what it had to answer leaves the reader with the command alone.
  assert.match(section, /asserted HTTP 201, exit 0/);
});

test('command timestamps are relative to the trimmed start, like every other section', () => {
  const section = buildCommandSection([{ at: 65, kind: 'run', text: 'true', exitCode: 0 }], takeRemap(5));
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
  const rows = buildTimeline(marks, takeRemap(0, CUT), 30).split('\n');
  assert.equal(rows.length, 2);
  assert.match(rows[0], /^00:02 - 00:15 {2}Before$/);
  assert.match(rows[1], /^00:15 - 00:30 {2}After$/);
});

test('hotkeys, captions and commands are renumbered the same way', () => {
  assert.match(buildHotkeySection([{ at: 25, keys: 'Escape' }], takeRemap(0, CUT)), /00:15/);
  assert.match(buildNoteSection([{ at: 25, text: 'Later' }], takeRemap(0, CUT)), /00:15/);
  assert.match(
    buildCommandSection([{ at: 25, kind: 'run', text: 'true', exitCode: 0 }], takeRemap(0, CUT)),
    /00:15/,
  );
});

test('a row that fell inside a cut is dropped rather than pointing at the wrong second', () => {
  assert.equal(buildHotkeySection([{ at: 12, keys: 'Escape' }], takeRemap(0, CUT)), '');
  assert.equal(buildNoteSection([{ at: 12, text: 'Gone' }], takeRemap(0, CUT)), '');
  assert.equal(buildCommandSection([{ at: 12, kind: 'run', text: 'true', exitCode: 0 }], takeRemap(0, CUT)), '');
});

// ---------- what the runbook says about the stretches cut out ----------

test('a take with nothing cut gains no section', () => {
  assert.equal(buildRemovedSection([], takeRemap(0)), '');
});

test('the reader is told the video is shorter than what was recorded', () => {
  const section = buildRemovedSection([{ from: 3, to: 6 }, { from: 10, to: 12 }], takeRemap(0));
  assert.match(section, /2 stretches/);
  assert.match(section, /5\.0s/);
});

// ---------- what a case adds to a step script ----------

// buildContext takes the whole of the runner's state, and none of it matters to the two decisions
// below: which names a step script can call, and what happens when a case claims one twice.
const { buildContext } = require('../src/skills/recording/scripts/record');
const { createTerminal } = require('../src/skills/recording/scripts/terminal');
const { createHuman } = require('../src/skills/recording/scripts/human');
const { SNAPSHOT, HEADER } = require('../src/skills/recording/scripts/scroll');
const { resolveSettings } = require('../src/skills/recording/scripts/settings');

const scopeFrom = (helpers) => buildContext({
  page: {}, outDir: PROJECT, marks: [], hotkeys: [], notes: [], dialogs: [], startedAt: Date.now(),
  pace: PACE, viewport: DEFAULTS.recording.viewport, human: {}, captions: { enabled: false },
  terminal: { term: {}, isOpen: () => false }, cuts: [], capture: {}, helpers,
});

test('a step script still calling redact() fails, and is pointed at the edit that replaced it', () => {
  const { redact } = scopeFrom({});
  assert.throws(() => redact('frame', async () => {}), /edit\.js.*cover/);
});

test('a helper a case adds is in the scope beside the ones every step script has', () => {
  const scope = scopeFrom({ api: { from: () => 'req' } });
  assert.equal(scope.api.from(), 'req');
  assert.equal(typeof scope.click, 'function');
  assert.equal(typeof scope.term, 'object');
});

test('a case cannot take a name a step script already means something by', () => {
  assert.throws(() => scopeFrom({ click: () => {} }), /click/);
});

test('a secret a case registers is scrubbed out of the panel and out of the runbook', async () => {
  // The value is registered the way a session is: after the terminal exists, before any command
  // is typed. Both the line that uses it and the line that echoes it back have to come out masked.
  const secret = 'a1b2c3-this-is-the-session-value';
  const settings = resolveSettings({ recording: { speed: 'fast' } }).recording;
  const sent = [];
  const terminal = createTerminal({
    page: { async evaluate(_fn, payload) { sent.push(payload); } },
    viewport: settings.viewport,
    config: settings.terminal,
    human: createHuman({ pace: settings.pace, viewport: settings.viewport, seed: 'secrets' }),
    pace: settings.pace,
    since: () => 0,
    root: PROJECT,
  });

  terminal.registerSecret(secret);
  try {
    await terminal.term.run(`echo ${secret}`, { pause: 'quick' });
  } finally {
    await terminal.dispose();
  }

  const drawn = sent.flatMap((payload) => payload.lines ?? [])
    .flatMap((row) => row.map((segment) => segment.text)).join('');
  assert.ok(drawn.includes('echo'), 'the command never reached the panel at all');
  assert.ok(!drawn.includes(secret), 'the session is on screen in the panel');

  const section = buildCommandSection(terminal.commands, takeRemap(0));
  assert.ok(section.includes('echo'), 'the command never reached the runbook');
  assert.ok(!section.includes(secret), 'the session is written out in the runbook');
});

test('cleaning up after the cases runs every one of them, and outlives one that throws', () => {
  const ran = [];
  // Synchronous by contract: the interrupt route calls this with a signal already in flight, so
  // anything returning a promise here would be abandoned unfinished.
  const results = runCaseDisposers([
    () => ran.push('first'),
    () => { throw new Error('already gone'); },
    () => ran.push('third'),
  ]);

  assert.equal(results, undefined);
  assert.deepEqual(ran, ['first', 'third']);
});


// ---------- a take that failed ----------

// What the operator is left with when a step script throws. The video is gone either way; what
// decides whether the failure can be worked on is knowing which step it happened in, because the
// alternative is counting the screenshots that were written and inferring it.

test('the failure names the step it happened in, and when', () => {
  const marks = [{ at: 0, label: 'Open the search screen' }, { at: 12, label: 'Reach the audit trail' }];
  const error = failedTakeError(
    { error: new Error('locator.click: Timeout 30000ms exceeded'), raw: null },
    { outDir: PROJECT, name: 'take', marks, trimAt: 0, videoOpts: {}, cuts: { all: () => [] }, at: 41 },
  );

  assert.match(error.message, /step 2/);
  assert.match(error.message, /Reach the audit trail/);
  assert.match(error.message, /00:41/);
  assert.match(error.message, /Timeout 30000ms exceeded/);
});

test('a take that failed before its first mark says so rather than naming a step', () => {
  const error = failedTakeError(
    { error: new Error('page.goto: net::ERR_CONNECTION_REFUSED'), raw: null },
    { outDir: PROJECT, name: 'take', marks: [], trimAt: 0, videoOpts: {}, cuts: { all: () => [] }, at: 3 },
  );
  assert.match(error.message, /before the first mark/);
  assert.match(error.message, /ERR_CONNECTION_REFUSED/);
});

test('the original failure is kept, so nothing about it is lost in the retelling', () => {
  const cause = new Error('locator.click: Timeout 30000ms exceeded');
  const error = failedTakeError({ error: cause, raw: null }, {
    outDir: PROJECT, name: 'take', marks: [], trimAt: 0, videoOpts: {}, cuts: { all: () => [] }, at: 1,
  });
  assert.equal(error.cause, cause);
});

test('with nothing recorded, the operator is told that rather than pointed at a file', () => {
  const error = failedTakeError({ error: new Error('nope'), raw: null }, {
    outDir: PROJECT, name: 'take', marks: [], trimAt: 0, videoOpts: {}, cuts: { all: () => [] }, at: 1,
  });
  assert.match(error.message, /Nothing had been recorded/);
});

// ---------- aiming at something that is not a size ----------

test('moveTo refuses a bounding box where it expects a number of pixels', async () => {
  const scope = scopeFrom({});
  await assert.rejects(
    () => scope.moveTo(100, 100, { x: 1, y: 2, width: 40, height: 20 }),
    /moveTo/,
  );
});

// A page that answers only what the pointer helpers ask it: where the mouse was told to go, and
// what a measurement of an element returned. Everything the browser does with that is out of scope
// here — what is being pinned down is which coordinates the helpers compute, and from what.
const FAST = resolveSettings({ recording: { speed: 'fast' } }).recording;

function pointerScope(snapshots = [], { header = 0, boxes = [], stops = true, capture = {}, marks = [], gone = [] } = {}) {
  const sent = [];
  // A sequence per locator: each measurement takes the next one, and the last stands for every
  // measurement after it. That is what makes a page still moving when it was measured expressible
  // here — one snapshot for where it was, the next for where it ended up.
  const queues = snapshots.map((entry) => (Array.isArray(entry) ? [...entry] : [entry]));
  const page = {
    // The header is measured in the page rather than in the element's own document, so it is the
    // page that answers for it.
    evaluate: async (fn) => (fn === HEADER ? header : undefined),
    mouse: {
      async move(x, y) { sent.push({ kind: 'move', x, y }); },
      async down() { sent.push({ kind: 'down' }); },
      async up() { sent.push({ kind: 'up' }); },
      async wheel(dx, dy) { sent.push({ kind: 'wheel', dx, dy }); },
    },
  };
  const locators = queues.map((queue, index) => ({
    // SETTLE reports whether the element really stopped; only a SNAPSHOT is a measurement.
    evaluate: async (fn) => (fn === SNAPSHOT ? (queue.length > 1 ? queue.shift() : queue[0]) : stops),
    boundingBox: async () => boxes[index] ?? null,
    scrollIntoViewIfNeeded: async () => { sent.push({ kind: 'jump' }); },
    // The element itself, as the page holds it: measured like the locator. `gone` true is removed
    // from the page; 'renamed' is still there under a label the locator no longer matches.
    async elementHandle() {
      const locator = this;
      return {
        evaluate: async (fn) => (fn === SNAPSHOT ? locator.evaluate(fn) : gone[index] !== true),
        boundingBox: locator.boundingBox,
        dispose: async () => {},
      };
    },
    count: async () => (gone[index] ? 0 : 1),
  }));
  const takeEnd = [];
  const scope = buildContext({
    page, outDir: PROJECT, marks, hotkeys: [], notes: [], dialogs: [], startedAt: Date.now(),
    pace: FAST.pace, viewport: FAST.viewport, captions: { enabled: false },
    human: createHuman({ pace: FAST.pace, viewport: FAST.viewport, seed: 'pointer' }),
    terminal: { term: {}, isOpen: () => false }, cuts: [], capture, helpers: {},
    onTakeEnd: (fn) => takeEnd.push(fn),
  });
  const endTake = async () => { for (const fn of takeEnd) await fn(); };
  return { scope, locators, sent, endTake };
}

// Where an element stands, as SNAPSHOT reports it: nothing scrollable around it, so a helper that
// wants to scroll to it has nothing to turn and leaves it where it is.
const standingAt = (rect, { maxTop = 0 } = {}) => ({
  target: rect,
  view: FAST.viewport,
  frames: [{
    rect: { top: 0, left: 0, width: FAST.viewport.width, height: FAST.viewport.height },
    scrollTop: 0, scrollLeft: 0, maxTop, maxLeft: 0,
  }],
  header: 0,
  inFrame: false,
});

const centreOf = (rect) => ({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
const lastMoveBefore = (sent, kind) => {
  const at = sent.findIndex((event) => event.kind === kind);
  return sent.slice(0, at).filter((event) => event.kind === 'move').pop();
};

test('moveTo with no target size at all goes ahead', async () => {
  // The guard is about a value that is not a number of pixels; leaving it out is how most calls
  // are written, and Fitts's law falls back to a default size for them.
  const { scope } = pointerScope();
  await assert.doesNotReject(() => scope.moveTo(100, 100));
});

test('a drag onto another element presses on the handle, not on what the page moved under it', async () => {
  // Both ends are measured before the button goes down, and the far end is measured where it
  // stands. Measuring it by scrolling to it would move the handle the press is aimed at.
  const handle = { top: 400, left: 200, width: 200, height: 20 };
  const onto = { top: 380, left: 700, width: 120, height: 60 };
  const { scope, locators, sent } = pointerScope([standingAt(handle), standingAt(onto)]);

  await scope.drag(locators[0], locators[1]);

  assert.deepEqual(lastMoveBefore(sent, 'down'), { kind: 'move', ...centreOf(handle) });
  assert.deepEqual(lastMoveBefore(sent, 'up'), { kind: 'move', ...centreOf(onto) });
  assert.equal(sent.filter((event) => event.kind === 'wheel').length, 0, 'the page was scrolled mid-drag');
});

test('a drag onto something outside the frame is refused, not scrolled to', async () => {
  const handle = { top: 400, left: 200, width: 200, height: 20 };
  // The page has room to scroll to it, which is what makes the refusal a decision rather than a
  // dead end: bringing it into the frame is possible, and it would cost the handle its position.
  const offScreen = { top: 1900, left: 200, width: 120, height: 60 };
  const { scope, locators, sent } = pointerScope([
    standingAt(handle), standingAt(offScreen, { maxTop: 4000 }),
  ]);

  await assert.rejects(() => scope.drag(locators[0], locators[1]), /frame/);
  assert.equal(sent.filter((event) => event.kind === 'down').length, 0, 'the button went down anyway');
});

test('a drag with nowhere named says so instead of computing NaN', async () => {
  const { scope, locators } = pointerScope([standingAt({ top: 400, left: 200, width: 200, height: 20 })]);
  await assert.rejects(() => scope.drag(locators[0], { to: 'the right' }), /drag\(\)/);
});

test('the helpers that move the pointer are all in the scope', () => {
  const scope = scopeFrom({});
  for (const name of ['moveTo', 'drag', 'scrollTo', 'click']) {
    assert.equal(typeof scope[name], 'function', name);
  }
});


// ---------- coming to rest, on a page that was still moving when it was measured ----------

// The heading that keeps a coasting page from being wheeled backwards is right for reaching
// something to press and wrong for arriving somewhere: it will happily call an overshoot "arrived"
// while the section sits with its first rows off the top of the frame. These two pin the line
// between the callers.
const scrolling = (rect, { scrollTop = 0, maxTop = 4000 } = {}) => ({
  target: rect,
  view: FAST.viewport,
  frames: [{
    rect: { top: 0, left: 0, width: FAST.viewport.width, height: FAST.viewport.height },
    scrollTop, scrollLeft: 0, maxTop, maxLeft: 0,
  }],
  inFrame: false,
});

const OVERSHOT = [
  scrolling({ top: 1400, left: 0, width: 1280, height: 300 }),                      // below the fold
  scrolling({ top: -40, left: 0, width: 1280, height: 300 }, { scrollTop: 1300 }),  // carried past
  scrolling({ top: 154, left: 0, width: 1280, height: 300 }, { scrollTop: 1106 }),  // at rest
];
const wheeledBack = (sent) => sent.some((event) => event.kind === 'wheel' && event.dy < 0);

test('scrollTo corrects an overshoot once the page has stopped', async () => {
  const { scope, locators, sent } = pointerScope([OVERSHOT]);
  await scope.scrollTo(locators[0], { pause: 0 });
  assert.ok(wheeledBack(sent), 'the section was left hanging off the top of the frame');
});

test('click leaves an overshoot alone: it only has to reach something it can press', async () => {
  const { scope, locators, sent } = pointerScope([OVERSHOT]);
  await scope.click(locators[0], { pause: 0 });
  assert.equal(wheeledBack(sent), false, 'the page slid back for a press that could already land');
});

test('an element the pinned header covers is refused, not pressed through the header', async () => {
  // Nothing can scroll, so it stays where it is: on screen, and under the band the page keeps
  // pinned over the top of the frame.
  const covered = scrolling({ top: 20, left: 0, width: 400, height: 40 }, { maxTop: 0 });
  const { scope, locators, sent } = pointerScope([covered], { header: 96 });

  await assert.rejects(() => scope.click(locators[0]), /header/);
  assert.equal(sent.filter((event) => event.kind === 'down').length, 0);
});

test('an element that is part of the pinned header is pressed, not refused as covered by it', async () => {
  // A language menu or a nav link lives inside the header. It sits in the band the header takes
  // out of the frame, and it is the header itself rather than something the header hides.
  const inHeader = { ...scrolling({ top: 24, left: 900, width: 90, height: 36 }, { maxTop: 0 }), pinnedToTop: true };
  const { scope, locators, sent } = pointerScope([inHeader], { header: 80 });

  await scope.click(locators[0], { pause: 0 });
  const pressedAt = lastMoveBefore(sent, 'down');
  assert.ok(pressedAt.x >= 900 && pressedAt.x <= 990, `pressed at x ${pressedAt.x}, off the element`);
  assert.ok(pressedAt.y >= 24 && pressedAt.y <= 60, `pressed at y ${pressedAt.y}, off the element`);
});

test('the header still covers an element inside an iframe that pins its own bar', () => {
  // Pinned in the frame's document says nothing about the page's header over the frame.
  const framed = { ...scrolling({ top: 20, left: 100, width: 200, height: 40 }, { maxTop: 0 }), inFrame: true, pinnedToTop: true };
  const { scope, locators } = pointerScope([framed], { header: 96, boxes: [{ x: 100, y: 20, width: 200, height: 40 }] });

  return assert.rejects(() => scope.click(locators[0]), /header/);
});

test('an element the header covers half of is pressed on the half below it', async () => {
  const half = scrolling({ top: 60, left: 0, width: 400, height: 120 }, { maxTop: 0 });
  const { scope, locators, sent } = pointerScope([half], { header: 96 });

  await scope.click(locators[0], { pause: 0 });
  const pressedAt = lastMoveBefore(sent, 'down');
  assert.ok(pressedAt.y > 96, `pressed at ${pressedAt.y}, inside the header band`);
  assert.ok(pressedAt.y < 180, `pressed at ${pressedAt.y}, below the element`);
});


test('an element inside an iframe is judged against the page\'s header, not its own document\'s', () => {
  // The snapshot of an element in a frame is measured in that frame; the header is measured in the
  // page, because that is where the mouse is and where the header that can cover it lives.
  const inFrame = { ...scrolling({ top: 20, left: 100, width: 200, height: 40 }, { maxTop: 0 }), inFrame: true };
  const { scope, locators } = pointerScope([inFrame], {
    header: 96,
    boxes: [{ x: 100, y: 20, width: 200, height: 40 }],
  });

  return assert.rejects(() => scope.click(locators[0]), /header/);
});

test('a sliver too small to aim at is not blamed on a header the page does not have', async () => {
  const sliver = scrolling({ top: 799.6, left: 0, width: 400, height: 100 }, { maxTop: 0 });
  const { scope, locators } = pointerScope([sliver], { header: 0 });

  await assert.rejects(() => scope.click(locators[0]), (error) => {
    assert.match(error.message, /not visible/);
    assert.doesNotMatch(error.message, /header/);
    return true;
  });
});

test('scrollTo keeps correcting while the page keeps coming up short', async () => {
  // One correction is not enough on a page whose wheel deltas do not land on the resting place:
  // giving up after it would fall through to the jump, which knows nothing about the header.
  const { scope, locators, sent } = pointerScope([[
    scrolling({ top: 1400, left: 0, width: 1280, height: 300 }),
    scrolling({ top: -40, left: 0, width: 1280, height: 300 }, { scrollTop: 1300 }),
    scrolling({ top: 30, left: 0, width: 1280, height: 300 }, { scrollTop: 1230 }),
    scrolling({ top: 200, left: 0, width: 1280, height: 300 }, { scrollTop: 1060 }),
  ]], { header: 96 });

  await scope.scrollTo(locators[0], { pause: 0 });
  assert.equal(sent.filter((event) => event.kind === 'jump').length, 0, 'it gave up and jumped');
});

test('after a jump, a scroll that has to arrive moves out from under the header', async () => {
  // A pane no wheel can reach: every measurement comes back the same, so the wheel is abandoned for
  // the jump — which leaves the element against the top edge, behind the header.
  // Behind the header, on a page that has room to scroll it clear: the hop is possible, the wheel
  // just never achieves it.
  const stuck = scrolling({ top: 20, left: 0, width: 1280, height: 300 }, { scrollTop: 500 });
  const { scope, locators, sent } = pointerScope([[
    stuck, stuck, stuck, stuck,
    scrolling({ top: 200, left: 0, width: 1280, height: 300 }, { scrollTop: 307 }),
  ]], { header: 96 });

  await scope.scrollTo(locators[0], { pause: 0 });
  const jumpedAt = sent.findIndex((event) => event.kind === 'jump');
  assert.ok(jumpedAt >= 0, 'the wheel was never abandoned, so this checks nothing');
  assert.ok(sent.slice(jumpedAt).some((event) => event.kind === 'wheel'), 'nothing made up for the header');
});


test('a page that never holds still is left where it is, rather than corrected into a bounce', async () => {
  // The wait for the page to stop ran out with the element still moving, so a correction would be
  // planned from a position it is already leaving — which is the bounce, for the whole budget.
  const { scope, locators, sent } = pointerScope([OVERSHOT], { stops: false });
  await scope.scrollTo(locators[0], { pause: 0 });
  assert.equal(wheeledBack(sent), false, 'it corrected against a page that was still moving');
});


test('a page that never holds still keeps its resting place instead of being cut to', async () => {
  // Still short at the last measurement, and the page was never seen to stop. Correcting it was
  // refused on exactly that measurement, so jumping on the strength of it would be the same
  // untrustworthy reading taken twice — and a jump is a cut in the video.
  const short = scrolling({ top: 30, left: 0, width: 1280, height: 300 }, { scrollTop: 1230 });
  const { scope, locators, sent } = pointerScope([[
    scrolling({ top: 1400, left: 0, width: 1280, height: 300 }),
    short, short, short, short,
  ]], { header: 96, stops: false });

  await scope.scrollTo(locators[0], { pause: 0 });
  assert.equal(sent.filter((event) => event.kind === 'jump').length, 0, 'it cut to the element');
});


// What the operator is told about a video kept from a take that did not finish. The recording
// ending at its own time limit is a second thing that went wrong, far from the failure the error
// names, and the file cannot say which of the two it stopped for.

const failureSaid = (endedEarly) => {
  const outDir = fs.mkdtempSync(path.join(PROJECT, 'ended-early-'));
  const raw = path.join(outDir, 'take.raw.mp4');
  // A real recording, because the sentence only appears once there is a video to say it about.
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-f', 'lavfi',
    '-i', 'testsrc=size=64x64:rate=10:duration=0.5', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', raw]);

  return failedTakeError({ error: new Error('locator.click: Timeout 30000ms exceeded'), raw, endedEarly }, {
    outDir, name: 'take', marks: [], trimAt: 0, videoOpts: { preset: 'ultrafast', crf: 28 },
    cuts: { all: () => [] }, at: 30, maxSeconds: 600,
  }).message;
};

test('a recording that ran out at its own limit is named beside the failure, not as it', () => {
  const said = failureSaid(true);
  assert.match(said, /take-failed\.mp4/);
  assert.match(said, /600s/);
  assert.match(said, /Timeout 30000ms exceeded/);
});

test('a recording the take stopped is handed over without that explanation', () => {
  const said = failureSaid(false);
  assert.match(said, /take-failed\.mp4/);
  assert.doesNotMatch(said, /600s/);
});


// ---------- a file upload, with and without the real picker ----------

const { createCuts } = require('../src/skills/recording/scripts/cuts');

// A page that answers what upload() asks of it, and records whether the file chooser was
// intercepted. `picker` stands in for the real one; without it upload() goes the way it always has.
function uploadScope({ picker = null, startedAt = Date.now() } = {}) {
  const sent = [];
  const notes = [];
  const cuts = createCuts();
  const page = {
    evaluate: async (fn) => (fn === HEADER ? 0 : { x: 0, y: 0, width: 800, height: 600 }),
    bringToFront: async () => sent.push({ kind: 'front' }),
    waitForEvent: async (name) => {
      sent.push({ kind: 'wait', name });
      return { setFiles: async (file) => sent.push({ kind: 'set', file }) };
    },
    mouse: {
      async move() {},
      async down() { sent.push({ kind: 'down' }); },
      async up() { sent.push({ kind: 'up' }); },
    },
  };
  const field = { top: 100, left: 100, width: 200, height: 30 };
  const locator = {
    evaluate: async (fn) => {
      if (fn === SNAPSHOT) return standingAt(field);
      return String(fn).includes('files') ? ['sample.csv'] : true;
    },
    boundingBox: async () => null,
    scrollIntoViewIfNeeded: async () => {},
  };
  const scope = buildContext({
    page, outDir: PROJECT, marks: [], hotkeys: [], notes, dialogs: [], startedAt,
    pace: FAST.pace, viewport: FAST.viewport,
    captions: { enabled: true, text: (key, params) => `${key}:${params.file}` },
    human: createHuman({ pace: FAST.pace, viewport: FAST.viewport, seed: 'upload' }),
    terminal: { term: {}, isOpen: () => false }, cuts, capture: {}, helpers: {},
    capturesBrowserUi: Boolean(picker), picker,
  });
  return { scope, locator, sent, notes, cuts };
}

test('a page recording sets the file through the intercepted chooser, and captions it', async () => {
  const { scope, locator, sent, notes, cuts } = uploadScope();
  await scope.upload(locator, '/tmp/in/sample.csv');

  // The chooser is waited for before the click: that is what keeps the real sheet from opening
  const kinds = sent.map((e) => e.kind);
  assert.ok(kinds.indexOf('wait') < kinds.indexOf('down'), 'the click came before the interception');
  assert.deepEqual(sent.find((e) => e.kind === 'wait'), { kind: 'wait', name: 'filechooser' });
  assert.deepEqual(sent.find((e) => e.kind === 'set'), { kind: 'set', file: '/tmp/in/sample.csv' });
  assert.deepEqual(notes.map((n) => n.text), ['uploadFile:sample.csv']);
  assert.deepEqual(cuts.all(), []);
});

test('with the real picker, nothing intercepts it and the stretch before it lands is cut', async () => {
  const calls = [];
  const picker = {
    browserPid: async () => 4242,
    stage: (file) => `/staged/upload-1/${path.basename(file)}`,
    async chooseFile(args) {
      calls.push(args);
      await args.open();
      args.onOpened();
      await new Promise((resolve) => setTimeout(resolve, 5));
      args.onLanded();
    },
  };
  // Five seconds into the take, so there is footage before the cut for the join to come from
  const { scope, locator, sent, notes, cuts } = uploadScope({ picker, startedAt: Date.now() - 5000 });
  await scope.upload(locator, 'relative/sample.csv');

  assert.equal(sent.filter((e) => e.kind === 'wait').length, 0, 'the chooser was intercepted');
  assert.equal(sent.filter((e) => e.kind === 'down').length, 1, 'the field was never clicked');
  assert.equal(calls[0].pid, 4242);
  // Sent to the folder holding the staged copy, not to wherever the step script keeps the file
  assert.equal(calls[0].folder, '/staged/upload-1');
  assert.deepEqual(notes, [], 'a caption stood in for a picker that is in the frame');

  const [cut] = cuts.all();
  assert.match(cut.reason, /file picker/);

  // What the encode makes of it: the stretch removed, and the two sides joined on held frames
  const filter = buildFilter(cuts.all(), 0);
  assert.equal(filter.removed.length, 1);
  assert.equal(filter.inserted.length, 1);
  assert.match(filter.graph, /stop_mode=clone/);
  assert.match(filter.graph, /start_mode=clone/);
});

test('a picker that fails part-way still has its stretch closed, so the failed take keeps the cut', async () => {
  const picker = {
    browserPid: async () => 4242,
    stage: (file) => file,
    async chooseFile(args) {
      await args.open();
      args.onOpened();
      throw new Error('another application came to the front');
    },
  };
  const { scope, locator, cuts } = uploadScope({ picker });
  await assert.rejects(scope.upload(locator, '/tmp/in/sample.csv'), /another application/);
  assert.equal(cuts.all().length, 1);
});

test('a stretch the runner cut says why, and one with no reason is still listed', () => {
  const removed = [
    { from: 3, to: 4, reasons: ['the file picker on the folder it opened on'] },
    { from: 10, to: 12 },
  ];
  const section = buildRemovedSection(removed, takeRemap(0, removed));
  assert.match(section, /2 stretches/);
  assert.match(section, /- 00:03 {2}1\.0s — the file picker on the folder it opened on/);
  // The second one lands a second earlier on the shortened video
  assert.match(section, /^- 00:09 {2}2\.0s$/m);
});

// ---------- the held frames at a join ----------

// The picker cut from the runner, 2.5s into the take after a 1s trim, with the held frames the
// graph puts where the two kept stretches meet. Same data the runner writes.
const JOIN = {
  trimAt: 1,
  removed: [{ from: 6, to: 9, reasons: ['the file picker on the folder it opened on'] }],
  inserted: [{ at: 9, duration: 1.4 }],
};
const joinRemap = takeRemap(JOIN.trimAt, JOIN.removed, JOIN.inserted);

test('a moment before a join keeps its place on the video', () => {
  assert.equal(joinRemap(4), 3);
});

test('a moment after a join moves past the cut and the held frames both', () => {
  // 3s cut out, 1.4s of held frames put in: 12s of the take is 12 - 1 - 3 + 1.4 on the video
  assert.equal(joinRemap(12), 9.4);
  // The first frame after the cut plays once its held copy has been shown
  assert.equal(joinRemap(9), 6.4);
});

test('every section of the runbook moves its rows through the same join', () => {
  const take = {
    ...TAKE, ...JOIN, duration: 16.4,
    marks: [{ at: 2, label: 'Before', box: null }, { at: 12.2, label: 'After', box: null }],
    hotkeys: [{ at: 12.2, keys: 'Escape' }], notes: [{ at: 12.2, text: 'Later' }],
    commands: [{ at: 12.2, kind: 'run', text: 'true', exitCode: 0 }],
    dialogs: [{ at: 12.2, kind: 'alert', message: 'Hi', accepted: true }],
  };
  const runbook = renderRunbook(take);
  assert.match(runbook, /^00:01 - 00:09 {2}Before$/m);
  assert.match(runbook, /^00:09 - 00:16 {2}After$/m);
  for (const row of ['`Escape`', 'Later', '`true`', 'alert: "Hi"']) {
    assert.ok(runbook.includes(`- 00:09  ${row}`) || runbook.includes(`- 00:09 - 00:10  ${row}`), row);
  }
  // The cut itself is listed where the join starts: the last frame before it, held
  assert.match(runbook, /^- 00:05 {2}3\.0s — the file picker/m);
});


// ---------- the take's data, and the runbook rendered from it ----------

const { frameRect } = require('../src/skills/recording/scripts/capture');

// A take as <name>-timeline.json holds it: every time in seconds of the take as recorded, so the
// trim point and the stretch cut out of it are the renderer's to apply.
const TAKE = {
  name: 'take', app: 'demo', baseUrl: 'http://localhost:3000', start: '/', configFile: null,
  stepsFile: path.join(PROJECT, 'steps.js'), video: path.join(PROJECT, 'out', 'take.mp4'),
  outDir: path.join(PROJECT, 'out'), runner: path.join(PROJECT, 'record.js'),
  recordedAt: '2026-10-08T00:00:00.000Z', captions: 'en', capture: 'window',
  captureFrame: { x: 0, y: 25, width: 1280, height: 800, scale: 2 },
  frame: { width: 2560, height: 1650 },
  duration: 44, trimAt: 2.5,
  removed: [{ from: 22.5, to: 26, reasons: ['the file picker on the folder it opened on'] }],
  marks: [
    { at: 2.6, label: 'Open the list', box: null },
    { at: 9.25, label: 'Search', box: { x: 400, y: 960, width: 400, height: 40 } },
    { at: 9.4, label: 'Blink', box: null },
    { at: 24, label: 'Inside the cut', box: null },
    { at: 27.1, label: 'Upload a file', box: null },
    { at: 41.7, label: 'Check the result', box: null },
  ],
  hotkeys: [{ at: 12.3, keys: '⌘ + K', label: 'Open search' }],
  notes: [{ at: 13, text: 'Seeded row' }, { at: 25, text: 'Gone' }],
  commands: [{ at: 30, kind: 'run', text: 'true', exitCode: 0, asserted: 'asserted HTTP 200' }],
  dialogs: [{ at: 35.2, kind: 'confirm', message: 'Delete?', accepted: true }],
  screenshots: [
    { at: 15, file: '01-list.png', box: null },
    { at: null, file: '99-full-page.png', box: null },
  ],
  fixes: ['seeded the database'], problems: ['GET /x 404'],
};

test('the runbook rendered from the take\'s data is the one the runner wrote before it had any', () => {
  // Written by the runner from these same inputs, before the runbook was rendered from data
  assert.equal(renderRunbook(TAKE), `---
name: take
app: demo
base_url: http://localhost:3000
start_path: /
captions: en
capture: window
capture_frame: 1280x800 at 0,25, 2x
config: (none — recorded with BASE_URL=http://localhost:3000)
steps: ${PROJECT}/steps.js
video: ${PROJECT}/out/take.mp4
duration_seconds: 44.0
recorded_at: 2026-10-08T00:00:00.000Z
---

# Runbook — take

## Re-run

\`\`\`bash
OUT_DIR=${PROJECT}/out node ${PROJECT}/record.js ${PROJECT}/steps.js
\`\`\`

The step script, the configuration and the account are all fixed, so the command above reproduces exactly this take.
To change what gets recorded, edit \`${PROJECT}/steps.js\`, not the runbook file.

## Steps in the video

00:00 - 00:06  Open the list
00:06 - 00:21  Blink
00:21 - 00:35  Upload a file
00:35 - 00:44  Check the result

## Keyboard shortcuts in the video

- 00:09  \`⌘ + K\` — Open search

## Captions shown in the video

- 00:10  Seeded row

## Commands run in the terminal

- 00:24  \`true\` — asserted HTTP 200, exit 0

## Dialogs the browser put up

- 00:29  confirm: "Delete?" — accepted

## Removed from the video

1 stretch totalling 3.5s were cut out of this take. Every timestamp above is on the shortened video.

- 00:20  3.5s — the file picker on the folder it opened on

## Screenshots

- 01-list.png
- 99-full-page.png

## Environment

- fixed automatically: seeded the database

## Page errors recorded during the take

- GET /x 404
`);
});

test('the timeline in the runbook is the one built from the same marks on their own', () => {
  const timeline = buildTimeline(TAKE.marks, takeRemap(TAKE.trimAt, TAKE.removed), TAKE.duration);
  assert.ok(renderRunbook(TAKE).includes(`## Steps in the video\n\n${timeline}\n\n`));
});

test('a video made from the take is described by its own remap, in the same layout', () => {
  // Twice as fast, nothing trimmed: every row lands at half the moment it was recorded at
  const runbook = renderRunbook(TAKE, { remap: (at) => at / 2, duration: 25 });
  assert.match(runbook, /^00:13 - 00:20 {2}Upload a file$/m);
  assert.match(runbook, /^- 00:06 {2}`⌘ \+ K`/m);
  assert.match(runbook, /^duration_seconds: 25\.0$/m);
});

test('a step keeps the box of the first element it acted on, in frame pixels, and its take time', async () => {
  const handle = { top: 400, left: 200, width: 200, height: 20 };
  const onto = { top: 380, left: 700, width: 120, height: 60 };
  // A window take on a 2x display, offset by the browser's own chrome: the conversion the
  // recorder itself uses, so a box here lands where the video shows the element
  const offset = { x: 0, y: 80, scale: 2 };
  const marks = [];
  const { scope, locators } = pointerScope([standingAt(handle), standingAt(onto)], {
    marks, capture: { pageToFrame: (box) => frameRect(box, offset) },
  });

  scope.mark('Nothing touched');
  scope.mark('Drag the handle');
  await scope.drag(locators[0], locators[1], { pause: 0 });
  await scope.click(locators[1], { pause: 0 });

  assert.equal(marks[0].box, null);
  assert.deepEqual(marks[1].box, frameRect({ x: 200, y: 400, width: 200, height: 20 }, offset));
  // Seconds since the take started, with no trim applied: pointerScope starts its clock as the
  // scope is built, so the marks sit at the very start of the take
  assert.ok(marks.every((m) => m.at >= 0 && m.at < 1), JSON.stringify(marks));
});

test('a step keeps a box that fits its element as the step ends, not only as it was clicked', async () => {
  // "Run sync" clicked, then relabelled "Sync queued": the same button, wider and a little taller,
  // and measured through the element, since a locator by its old name would no longer find it
  const clicked = { top: 300, left: 200, width: 90, height: 30 };
  const queued = { top: 298, left: 200, width: 130, height: 34 };
  // Clicked, then scrolled out from under where it was: no longer the element the viewer saw acted on
  const moved = { top: 600, left: 500, width: 100, height: 30 };
  const last = { top: 100, left: 40, width: 60, height: 20 };
  const offset = { x: 0, y: 80, scale: 2 };
  const marks = [];
  const standing = [clicked, moved, last, last].map((rect) => standingAt(rect));
  const { scope, locators, endTake } = pointerScope(standing, {
    marks, gone: ['renamed', false, false, true], capture: { pageToFrame: (box) => frameRect(box, offset) },
  });
  const frameBox = ({ top, left, width, height }) => frameRect({ x: left, y: top, width, height }, offset);

  scope.mark('Run the sync');
  await scope.click(locators[0], { pause: 0 });
  standing[0].target = queued;
  scope.mark('Scroll the list');
  await scope.click(locators[1], { pause: 0 });
  standing[1].target = { ...moved, top: 100 };
  scope.mark('Close the dialog');
  await scope.click(locators[2], { pause: 0 });
  scope.mark('The dialog is gone');
  await scope.click(locators[3], { pause: 0 });
  await endTake();

  // The union of both measurements, in frame pixels
  assert.deepEqual(marks[0].box, frameBox({ top: 298, left: 200, width: 130, height: 34 }));
  assert.deepEqual(marks[1].box, frameBox(moved));
  assert.deepEqual(marks[2].box, frameBox(last));
  // Measured at the end of the take, and gone by then: the box it was acted on at
  assert.deepEqual(marks[3].box, frameBox(last));
});
