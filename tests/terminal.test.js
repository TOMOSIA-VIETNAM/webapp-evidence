// The panel's geometry: how many rows of output fit, and how wide the shell should believe it
// is. Both are read by the runner before a browser exists, and both go wrong quietly — too many
// rows and the newest output is drawn below the bottom edge of the panel, too few columns and
// every listing comes out one item per line.
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  visibleRows, columnsFor, isBehindPanel, LINE_HEIGHT, PANEL_CHROME_PX,
} = require('../src/skills/recording/scripts/terminal');
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
