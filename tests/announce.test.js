// The notice that goes up before anything is recorded. It is its own command because of the
// order consent has to happen in: the person about to have their screen recorded is not
// necessarily looking at the terminal, so the notice comes first and sends them to it.
//
// What it says is written by the caller. The agent is already talking to that person in their
// own language, and a list of languages here would have offered three of them.
const test = require('node:test');
const assert = require('node:assert/strict');
const { parse, DEFAULT_WAIT_SECONDS } = require('../src/skills/recording/scripts/announce');

test('a message is all it needs, and the wait has a default', () => {
  assert.deepEqual(
    parse(['--message', 'Có yêu cầu quay màn hình này.']),
    { message: 'Có yêu cầu quay màn hình này.', seconds: DEFAULT_WAIT_SECONDS },
  );
});

test('the wait is long, because it is a person being waited for', () => {
  // The notice does not dismiss itself: one that did is one they may never see
  assert.ok(DEFAULT_WAIT_SECONDS >= 60);
});

test('options may be written with an equals sign', () => {
  assert.equal(parse(['--message=Xin chào', '--seconds=90']).seconds, 90);
});

test('a message in any language is passed through untouched', () => {
  // Nothing here knows which languages exist, which is the point
  for (const message of ['English text', '日本語のテキスト', 'Tiếng Việt', 'Ελληνικά']) {
    assert.equal(parse(['--message', message]).message, message);
  }
});

test('no message is refused: there is nothing to show', () => {
  assert.throws(() => parse(['--seconds', '60']), /--message is required/);
  assert.throws(() => parse(['--message', '   ']), /--message is required/);
});

test('a wait of no time at all is refused', () => {
  // Zero would make it a notice nobody could press, which is the failure it exists to avoid
  assert.throws(() => parse(['--message', 'x', '--seconds', '0']), /positive/);
});

test('an unknown option says so rather than being ignored', () => {
  assert.throws(() => parse(['--message', 'x', '--colour', 'red']), /--colour/);
});
