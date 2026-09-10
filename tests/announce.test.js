// The notice that goes up before anything is recorded. It is its own command because of the
// order consent has to happen in: the person about to have their screen recorded is not
// necessarily looking at the terminal, so the notice comes first and sends them to it.
const test = require('node:test');
const assert = require('node:assert/strict');
const { parse, KINDS } = require('../src/skills/recording/scripts/announce');
const { noticeText, LOCALE_KEYS } = require('../src/skills/recording/scripts/captions');

test('a kind and a language are enough, and the language defaults to English', () => {
  assert.deepEqual(parse(['--kind', 'confirm']), { kind: 'confirm', locale: 'en', seconds: 300 });
});

test('the wait is long, because it is a person being waited for', () => {
  // The notice does not dismiss itself: one that did is one they may never see
  assert.ok(parse(['--kind', 'confirm']).seconds >= 60);
});

test('options may be written with an equals sign', () => {
  assert.equal(parse(['--kind=confirm', '--locale=vi']).locale, 'vi');
});

test('a kind that is not the one it shows is refused by name', () => {
  assert.throws(() => parse(['--kind', 'warn']), /confirm/);
});

test('a language the notices are not written in is refused', () => {
  assert.throws(() => parse(['--kind', 'confirm', '--locale', 'de']), /Invalid language/);
});

test('a wait of no time at all is refused', () => {
  // Zero would make it a notice nobody could press, which is the failure it exists to avoid
  assert.throws(() => parse(['--kind', 'confirm', '--seconds', '0']), /positive/);
});

test('an unknown option says so rather than being ignored', () => {
  assert.throws(() => parse(['--kind', 'confirm', '--colour', 'red']), /--colour/);
});

test('both notices exist in every language the skill claims to speak', () => {
  for (const locale of LOCALE_KEYS) {
    for (const key of Object.values(KINDS)) {
      const text = noticeText(key, locale);
      assert.ok(text.length > 20, `${key} in ${locale} is too short to say anything`);
    }
  }
});

test('both notices ask to be pressed, because neither dismisses itself', () => {
  for (const locale of LOCALE_KEYS) {
    for (const key of Object.values(KINDS)) {
      const text = noticeText(key, locale);
      assert.match(text, /OK/, `${key} in ${locale} does not say what to press`);
    }
  }
});

test('the one notice carries everything the person has to do before answering', () => {
  // It is the only thing they see on that screen: turn off notifications, press it, go and
  // answer. A second notice after the answer would send them back for what they already agreed.
  for (const locale of LOCALE_KEYS) {
    const text = noticeText('screenCaptureConfirm', locale);
    assert.ok(text.length > 120, `the notice in ${locale} is too short to say all of it`);
  }
});
