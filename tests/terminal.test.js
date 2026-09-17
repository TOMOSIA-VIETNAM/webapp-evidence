// The panel's geometry and its pacing: how many rows of output fit, how tall the panel has to be
// to hold them, how fast the window over a long output may travel, and how wide the shell should
// believe it is. All of it is read by the runner before a browser exists, and all of it goes
// wrong quietly — a row drawn below the bottom edge of the panel, a column count that makes every
// listing come out one item per line, an output that scrolls past between two frames of the video.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// The panel refuses to write a script inside the skill directory, and it reads where that is from
// session.js — which refuses to load from in there at all. This repository IS that directory, so
// the scratch project is named before the module is required.
const PROJECT = fs.mkdtempSync(path.join(os.tmpdir(), 'evidence-terminal-'));
process.env.PROJECT_ROOT = PROJECT;
test.after(() => fs.rmSync(PROJECT, { recursive: true, force: true }));

const {
  createTerminal, visibleRows, idleHeight, heightFor, revealPlan, columnsFor, isBehindPanel,
  LINE_HEIGHT, PANEL_CHROME_PX, IDLE_ROWS,
} = require('../src/skills/recording/scripts/terminal');
const { createHuman } = require('../src/skills/recording/scripts/human');
const { resolveSettings } = require('../src/skills/recording/scripts/settings');

test('the rows sent fit inside the panel, with none drawn past its bottom edge', () => {
  // The height is derived from the frame, so it is read from a resolved configuration rather
  // than from the defaults, where it is still the instruction to derive one.
  const { height, fontSize } = resolveSettings({}).recording.terminal;
  const rows = visibleRows(height, fontSize);
  assert.ok(rows * fontSize * LINE_HEIGHT <= height - PANEL_CHROME_PX);
});

test('a taller panel shows more rows and a bigger font shows fewer', () => {
  assert.ok(visibleRows(400, 13) > visibleRows(300, 13));
  assert.ok(visibleRows(300, 18) < visibleRows(300, 13));
});

test('even a panel at its smallest allowed height shows something', () => {
  assert.ok(visibleRows(120, 24) >= 3);
});

test('the column count follows the frame width', () => {
  assert.ok(columnsFor(1280, 13) > columnsFor(800, 13));
  assert.ok(columnsFor(1280, 13) > 100);
});

test('a narrow frame still reports a width a command-line tool can lay out in', () => {
  assert.ok(columnsFor(320, 24) >= 40);
});

// ---------- what the open panel covers ----------

const box = (y, height) => ({ x: 0, y, width: 100, height });

test('an element in the upper part of the frame is clear of the panel', () => {
  assert.equal(isBehindPanel(box(100, 40), 800, 300), false);
});

test('an element below the top edge of the panel is behind it', () => {
  assert.equal(isBehindPanel(box(600, 40), 800, 300), true);
});

test('an element only just overlapping the panel still counts as covered', () => {
  // Its top is clear, its bottom is not: half a button in the video is not a visible click.
  assert.equal(isBehindPanel(box(480, 40), 800, 300), true);
});

test('an element ending exactly on the panel edge is not covered', () => {
  assert.equal(isBehindPanel(box(460, 40), 800, 300), false);
});

test('a taller panel covers more of the frame', () => {
  assert.equal(isBehindPanel(box(420, 40), 800, 300), false);
  assert.equal(isBehindPanel(box(420, 40), 800, 420), true);
});

// ---------- the height that holds a given amount of output ----------

const FONT = 13;
const CEILING = 300;
const bounds = { base: idleHeight(FONT), ceiling: CEILING };

test('a panel with nothing to show is still a panel', () => {
  // Sliding fully out and back between commands is motion that means nothing, so the floor is
  // the title bar and a few rows rather than zero.
  assert.equal(heightFor(0, FONT, bounds), idleHeight(FONT));
  assert.equal(heightFor(1, FONT, bounds), idleHeight(FONT));
  assert.ok(visibleRows(idleHeight(FONT), FONT) >= IDLE_ROWS);
});

test('more output than the frame has room for stops at the configured ceiling', () => {
  assert.equal(heightFor(500, FONT, bounds), CEILING);
  assert.ok(heightFor(8, FONT, bounds) < CEILING);
});

test('a height and a row count say the same thing about each other', () => {
  // The runner decides in rows and the page draws in pixels. A height that shows one row fewer
  // than it was asked for puts the newest line below the bottom edge, where nothing draws it.
  for (const rows of [3, 5, 9, 13]) {
    assert.equal(visibleRows(heightFor(rows, FONT, bounds), FONT), rows, `${rows} rows`);
  }
});

// ---------- how fast the window may travel ----------

const pacing = (config = {}) => resolveSettings(config).recording.pace;

test('an overflow short enough to read is revealed at reading pace', () => {
  const pace = pacing();
  const { rowsPerSecond, durationMs } = revealPlan(20, pace);
  assert.equal(rowsPerSecond, 1000 / pace.panelRowSlowestMs);
  assert.ok(durationMs < pace.panelRevealMs);
});

test('an overflow too long to read at that pace is capped, and reported as too long', () => {
  const pace = pacing();
  const { rowsPerSecond, durationMs } = revealPlan(400, pace);
  assert.equal(rowsPerSecond, 1000 / pace.panelRowFastestMs);
  // Nothing is truncated: it takes as long as it takes, and the runner says so instead.
  assert.ok(durationMs > pace.panelRevealWarnMs);
});

test('between the two ends, the size of the output does not decide how long it takes', () => {
  const pace = pacing();
  const middle = revealPlan(90, pace);
  assert.ok(middle.rowsPerSecond > 1000 / pace.panelRowSlowestMs);
  assert.ok(middle.rowsPerSecond < 1000 / pace.panelRowFastestMs);
  assert.ok(Math.abs(middle.durationMs - pace.panelRevealMs) < 1);
});

test('nothing waiting below the window is no movement at all', () => {
  assert.equal(revealPlan(0, pacing()).durationMs, 0);
});

test('a faster take scrolls proportionally faster', () => {
  const normal = revealPlan(90, pacing());
  const fast = revealPlan(90, pacing({ recording: { speed: 'fast' } }));
  assert.ok(fast.rowsPerSecond > normal.rowsPerSecond);
  assert.ok(fast.durationMs < normal.durationMs);
});

// ---------- a real shell, printing more than the panel can hold ----------

// The panel is never opened here: what is checked is the payload the runner would send, which is
// the only thing that decides what a frame of the video can contain.
function recordingPage() {
  const sent = [];
  return {
    sent,
    async evaluate(_fn, payload) { sent.push(payload); },
  };
}

function terminalUnderTest(config = {}, root = process.cwd()) {
  const settings = resolveSettings({ recording: { speed: 'fast', ...config } }).recording;
  const page = recordingPage();
  const built = createTerminal({
    page,
    viewport: settings.viewport,
    config: settings.terminal,
    human: createHuman({ pace: settings.pace, viewport: settings.viewport, seed: 'reveal' }),
    pace: settings.pace,
    since: () => 0,
    root,
  });
  return { ...built, page, settings };
}

// What the panel is showing in a given update: the rows between the window's position and the
// bottom edge of a panel that tall.
const windowOf = (payload, fontSize) => {
  const top = Math.floor(payload.scrollRow);
  return { top, bottom: top + visibleRows(payload.height, fontSize) };
};

test('every line of an output too long for the panel lands inside some frame', async () => {
  const { term, page, dispose, settings } = terminalUnderTest();
  try {
    await term.open();
    await term.run('seq 40', { pause: 'quick' });
  } finally {
    await dispose();
  }

  const text = (payload, row) => (payload.lines[row - payload.linesFrom] || [])
    .map((segment) => segment.text).join('');

  // Every number seq printed was on the panel at some point, not just the last screenful.
  const shown = new Set();
  for (const payload of page.sent) {
    const { top, bottom } = windowOf(payload, settings.terminal.fontSize);
    for (let row = top; row < bottom; row++) shown.add(text(payload, row).trim());
  }
  for (let i = 1; i <= 40; i++) {
    assert.ok(shown.has(String(i)), `line ${i} was never inside the panel`);
  }
});

test('the window only ever moves down, and never past what it has shown', async () => {
  const { term, page, dispose, settings } = terminalUnderTest();
  try {
    await term.open();
    await term.run('seq 40', { pause: 'quick' });
    // The second command resizes the panel, which is where a window measured from the top edge
    // goes wrong: the bottom edge comes up ten rows and the newest output is left above it.
    await term.run('echo done', { pause: 'quick' });
  } finally {
    await dispose();
  }

  let previous = null;
  for (const payload of page.sent) {
    const here = windowOf(payload, settings.terminal.fontSize);
    if (previous) {
      assert.ok(here.top >= previous.top, 'the window jumped back up the output');
      // Overlapping windows are what "no line was skipped" means frame by frame: a step wider
      // than the panel would carry rows across it between two updates and into no frame at all.
      assert.ok(here.top <= previous.bottom, 'the window skipped past rows it never showed');
      // A resize moves the panel's edges, not the output inside it. The row on the bottom row
      // stays there, so a panel that has just shrunk is not suddenly behind again.
      assert.ok(here.bottom >= previous.bottom, 'resizing the panel took back rows it had reached');
    }
    previous = here;
  }
  assert.ok(previous.top > 0, 'the output never scrolled, so this proved nothing');
});

test('the panel grows for an output that needs the room and settles back for one that does not', async () => {
  const { term, page, dispose, settings } = terminalUnderTest();
  const floor = idleHeight(settings.terminal.fontSize);
  let grown = 0;
  try {
    await term.open();
    assert.equal(page.sent[page.sent.length - 1].height, floor);
    await term.run('seq 40', { pause: 'quick' });
    grown = page.sent[page.sent.length - 1].height;
    await term.run('echo done', { pause: 'quick' });
  } finally {
    await dispose();
  }

  assert.ok(grown > floor, 'the panel never grew for forty lines of output');
  assert.ok(grown <= settings.terminal.height, 'the panel grew past the configured ceiling');
  assert.equal(page.sent[page.sent.length - 1].height, floor);
});

test('a resize takes as long as its direction says, and only when the height changes', async () => {
  const { term, page, dispose, settings } = terminalUnderTest();
  try {
    await term.open();
    await term.run('seq 40', { pause: 'quick' });
    await term.run('echo done', { pause: 'quick' });
  } finally {
    await dispose();
  }

  const moves = [];
  let height = null;
  for (const payload of page.sent) {
    if (height !== null && payload.height !== height) moves.push(payload.heightMs);
    else if (height !== null) assert.equal(payload.heightMs, 0);
    height = payload.height;
  }
  assert.ok(moves.includes(settings.pace.panelGrowMs), 'nothing was ever sent as a grow');
  assert.ok(moves.includes(settings.pace.panelShrinkMs), 'nothing was ever sent as a shrink');
});

test('an output that takes too long to scroll past is named on stdout, not cut short', async () => {
  // The threshold is lowered instead of printing the two hundred lines it would take to cross the
  // real one: what is being checked is that the runner speaks up, and which command it names.
  const { term, page, dispose } = terminalUnderTest({ pace: { panelRevealWarnMs: 200 } });
  const said = [];
  const log = console.log;
  console.log = (...args) => said.push(args.join(' '));
  try {
    await term.open();
    await term.run('seq 40', { pause: 'quick' });
  } finally {
    console.log = log;
    await dispose();
  }

  const warning = said.find((line) => line.includes('seq 40'));
  assert.ok(warning, `nothing was said about the long output: ${JSON.stringify(said)}`);
  // Every line still went to the panel: the runner asks for a shorter command, it does not fold.
  const last = page.sent[page.sent.length - 1];
  assert.ok(last.scrollRow > 0);
});

// ---------- a file, shown and then run ----------

test('the script is on disk before the panel shows it, and both commands are in the take', async () => {
  const { term, commands, dispose } = terminalUnderTest({}, PROJECT);
  const file = path.join(PROJECT, 'check-export.sh');
  try {
    const result = await term.script(file, 'echo counted 3 rows\n', { pause: 'quick' });
    assert.equal(result.exitCode, 0);
  } finally {
    await dispose();
  }

  assert.equal(fs.readFileSync(file, 'utf8'), 'echo counted 3 rows\n');
  // Typed the way someone at that shell would type them: relative to where the shell is.
  assert.deepEqual(commands.map((entry) => entry.text), ['cat check-export.sh', 'sh check-export.sh']);
  assert.ok(commands.every((entry) => entry.kind === 'run'));
});

test('another interpreter is named by the step script rather than guessed from the name', async () => {
  const { term, commands, dispose } = terminalUnderTest({}, PROJECT);
  const file = path.join(PROJECT, 'count.js');
  try {
    await term.script(file, 'console.log(3);\n', { run: 'node count.js', pause: 'quick' });
  } finally {
    await dispose();
  }
  assert.deepEqual(commands.map((entry) => entry.text), ['cat count.js', 'node count.js']);
});

test('a script inside the skill directory is refused, like everything else a take writes', async () => {
  const { term, dispose } = terminalUnderTest({}, PROJECT);
  const inside = path.resolve(__dirname, '../src/skills/recording/scratch.sh');
  try {
    await assert.rejects(() => term.script(inside, 'echo no\n'), /skill directory/);
  } finally {
    await dispose();
  }
  assert.ok(!fs.existsSync(inside), 'the refused script was written anyway');
});

test('a script with nothing in it is a mistake worth naming, not an empty file', async () => {
  const { term, dispose } = terminalUnderTest({}, PROJECT);
  try {
    await assert.rejects(() => term.script(path.join(PROJECT, 'empty.sh')), /term\.script\(/);
  } finally {
    await dispose();
  }
});

test('a command wider than the panel is wrapped onto a second row, not cut off at the edge', async () => {
  const { term, page, dispose, settings } = terminalUnderTest();
  const { fontSize } = settings.terminal;
  const width = columnsFor(settings.viewport.width, fontSize);
  // Long enough to run off the edge, and echoed back so the assertion does not rest on the
  // runner's own drawing of the line alone.
  const argument = 'w'.repeat(width);
  try {
    await term.open();
    await term.run(`echo ${argument}`, { pause: 'quick' });
  } finally {
    await dispose();
  }

  const rowsOf = (payload) => payload.lines.map((row) => row.map((s) => s.text).join(''));
  const everyRow = page.sent.flatMap(rowsOf);
  assert.ok(
    everyRow.every((row) => row.length <= width),
    'a row was drawn wider than the panel, which clips it at the right edge'
  );
  // The whole argument reached the panel: the tail of it is on a row of its own.
  assert.ok(
    everyRow.some((row) => row.startsWith('w') && row.trim().length > 0),
    'the wrapped remainder of the line never reached the panel'
  );
});
