const test = require('node:test');
const assert = require('node:assert');
const { createScreen } = require('../src/skills/recording/scripts/ansi.js');

const plain = (screen) => screen.lines().map((segments) => segments.map((s) => s.text).join(''));

test('a newline starts a line and \\r rewrites the one in progress', () => {
  const screen = createScreen();
  screen.write('first\n');
  screen.write('  30%\r  80%\r 100%');
  assert.deepStrictEqual(plain(screen), ['first', ' 100%']);
});

test('backspace steps back a column and the next character overwrites', () => {
  const screen = createScreen();
  screen.write('cat\b\bo');
  assert.deepStrictEqual(plain(screen), ['cot']);
});

test('a tab advances to the next eight-column stop', () => {
  const screen = createScreen();
  screen.write('ab\tc');
  assert.deepStrictEqual(plain(screen), ['ab      c']);
});

test('colour applies until it is reset, and survives the line it started on', () => {
  const screen = createScreen();
  screen.write('\x1b[31mred\nstill red\x1b[0m done');
  const [first, second] = screen.lines();
  assert.strictEqual(first[0].fg, 1);
  assert.strictEqual(second[0].fg, 1);
  assert.strictEqual(second[1].fg, null);
});

test('bright colours land above the eight basic ones', () => {
  const screen = createScreen();
  screen.write('\x1b[92mbright');
  assert.strictEqual(screen.lines()[0][0].fg, 10);
});

test('an extended colour is stepped over, not read as separate attributes', () => {
  const screen = createScreen();
  screen.write('\x1b[38;5;196mx');
  const [cell] = screen.lines()[0];
  assert.strictEqual(cell.bold, false);
  assert.strictEqual(cell.dim, false);
});

test('a colour run is drawn as one segment, not one per character', () => {
  const screen = createScreen();
  screen.write('\x1b[31mabcdef');
  assert.strictEqual(screen.lines()[0].length, 1);
});

test('erase-line clears from the cursor, from the start, or the whole line', () => {
  const toEnd = createScreen();
  toEnd.write('abcdef\r\x1b[3C');      // cursor movement is ignored, so write instead
  toEnd.write('abcdef');
  toEnd.write('\r---\x1b[K');
  assert.deepStrictEqual(plain(toEnd), ['---']);

  const whole = createScreen();
  whole.write('abcdef\x1b[2K');
  assert.deepStrictEqual(plain(whole), ['']);

  const toStart = createScreen();
  toStart.write('abcdef\r\x1b[1K');
  assert.deepStrictEqual(plain(toStart), [' bcdef']);
});

test('an escape sequence split across two writes parses as one', () => {
  const split = createScreen();
  split.write('\x1b[3');
  split.write('1mred');

  const whole = createScreen();
  whole.write('\x1b[31mred');

  assert.deepStrictEqual(split.lines(), whole.lines());
});

test('an operating-system command is swallowed rather than printed', () => {
  const bell = createScreen();
  bell.write('\x1b]0;window title\x07after');
  assert.deepStrictEqual(plain(bell), ['after']);

  const stringTerminator = createScreen();
  stringTerminator.write('\x1b]0;window title\x1b\\after');
  assert.deepStrictEqual(plain(stringTerminator), ['after']);
});

test('an unhandled sequence is dropped instead of leaking its bytes as text', () => {
  const screen = createScreen();
  screen.write('\x1b[2J\x1b[1;1Hclean\x1b[?25l');
  assert.deepStrictEqual(plain(screen), ['clean']);
});

test('switching to the alternate screen is refused by name', () => {
  const screen = createScreen();
  assert.throws(() => screen.write('\x1b[?1049h'), (e) => e.code === 'ALT_SCREEN');
});

test('leaving the alternate screen is not an error on its own', () => {
  const screen = createScreen();
  screen.write('\x1b[?1049lback');
  assert.deepStrictEqual(plain(screen), ['back']);
});

test('scrollback is capped so a long-running command cannot grow without limit', () => {
  const screen = createScreen({ maxLines: 10 });
  for (let i = 0; i < 100; i++) screen.write(`line ${i}\n`);
  assert.ok(screen.rowCount() <= 10);
  assert.ok(screen.text().includes('line 99'));
  assert.ok(!screen.text().includes('line 50'));
});

test('writing past the end of a shorter line pads with spaces, keeping columns aligned', () => {
  const screen = createScreen();
  screen.write('ab\rxyz123');
  assert.deepStrictEqual(plain(screen), ['xyz123']);

  const padded = createScreen();
  padded.write('\n');
  padded.write('abc\r');
  padded.write('\x1b[K');
  padded.write('z');
  assert.deepStrictEqual(plain(padded), ['', 'z']);
});
