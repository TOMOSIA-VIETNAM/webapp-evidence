const test = require('node:test');
const assert = require('node:assert');
const { createScrub, MASK } = require('../src/skills/recording/scripts/scrub.js');

test('nothing configured leaves the text alone', () => {
  assert.strictEqual(createScrub()('plain output'), 'plain output');
});

test('a secret is masked everywhere it appears, not only the first time', () => {
  const scrub = createScrub({ secrets: ['EvSecret#7rq'] });
  const out = scrub('login EvSecret#7rq then EvSecret#7rq again');
  assert.ok(!out.includes('EvSecret#7rq'));
  assert.strictEqual(out.split(MASK).length - 1, 2);
});

test('a secret containing regular-expression characters is matched literally', () => {
  const scrub = createScrub({ secrets: ['a.c*d'] });
  assert.strictEqual(scrub('abcxd'), 'abcxd');
  assert.strictEqual(scrub('a.c*d'), MASK);
});

test('a value too short to be a credential is ignored', () => {
  const scrub = createScrub({ secrets: ['ab'] });
  assert.strictEqual(scrub('abcabc'), 'abcabc');
});

test('a configured pattern is applied globally even when written without the flag', () => {
  const scrub = createScrub({ patterns: [/ghp_[A-Za-z0-9]{4,}/] });
  const out = scrub('ghp_aaaa and ghp_bbbb');
  assert.strictEqual(out, `${MASK} and ${MASK}`);
});

test('a pattern is rejected when it is not a regular expression', () => {
  assert.throws(() => createScrub({ patterns: ['ghp_'] }), /regular expression/);
});

test('a pattern that matches the empty string is rejected rather than masking everything', () => {
  assert.throws(() => createScrub({ patterns: [/x*/] }), /empty string/);
});

test('the same instance can be applied repeatedly without carrying match position over', () => {
  const scrub = createScrub({ patterns: [/token=\w+/g] });
  assert.strictEqual(scrub('token=abc'), MASK);
  assert.strictEqual(scrub('token=abc'), MASK);
});
