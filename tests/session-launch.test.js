// What the browser is told at launch. The recording never sees these decisions being made, and
// the failure they prevent is the kind nobody looks for: Chrome putting something of its own in
// front of the application, in a video meant to show the application.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// session.js refuses to run from inside the skill directory, and this repository IS that
// directory. Point it at a scratch project before the module is loaded.
process.env.PROJECT_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'evidence-session-'));

const { NO_BROWSER_POPUPS } = require('../src/skills/recording/scripts/session');

test('the browser is told not to offer a translation', () => {
  // A page in another language than the browser's raises a bubble over the page itself, so it
  // reaches a recording of page content as well as one of the window. It turned up in a real take.
  assert.ok(NO_BROWSER_POPUPS.some((arg) => /Translate/.test(arg)));
});

test('nor to offer to save a password after a sign-in', () => {
  assert.ok(NO_BROWSER_POPUPS.some((arg) => /save-password/.test(arg)));
});

test('nor to show anything it puts up on a first run', () => {
  for (const expected of ['--no-first-run', '--no-default-browser-check']) {
    assert.ok(NO_BROWSER_POPUPS.includes(expected), `${expected} is not passed`);
  }
});

test('every one of them is a flag, so none can be read as a URL to open', () => {
  for (const arg of NO_BROWSER_POPUPS) assert.match(arg, /^--/);
});
