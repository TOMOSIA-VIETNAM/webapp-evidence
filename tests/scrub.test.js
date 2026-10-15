const test = require('node:test');
const assert = require('node:assert');
const { createScrub, MASK } = require('../src/skills/recording/scripts/scrub.js');

test('with no pattern configured, ordinary output that looks like a value is left exactly as it is', () => {
  const text = '{"active": true, "theme": "dark mode", "trueName": 1, "session": "a1b2c3d4"}';
  assert.strictEqual(createScrub({ patterns: [] })(text), text);
});

test('a pattern replaces only the text it matches, never the words around it', () => {
  const scrub = createScrub({ patterns: [/sk-[a-z0-9]+/] });
  const out = scrub('{"active": true, "theme": "dark mode", "trueName": 1, "key": "sk-abc123"}');
  assert.strictEqual(out, `{"active": true, "theme": "dark mode", "trueName": 1, "key": "${MASK}"}`);
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
