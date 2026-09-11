// Settings merge covers three separate promises the config file makes to its readers:
// scope keys win over the legacy root keys, `speed` scales the built-in pace while a hand
// written `pace` stays absolute, and env vars beat everything. Assertions target behaviour,
// not message wording, so translating the runner does not rewrite the suite.
const test = require('node:test');
const assert = require('node:assert/strict');

const { DEFAULTS, resolveSettings } = require('../src/skills/recording/scripts/settings');

const RECORDING_ENV = ['HEADED', 'BROWSER_CHANNEL', 'EVIDENCE_OVERWRITE', 'CAPTIONS', 'CAPTION_LOCALE'];

// resolveSettings reads process.env directly, so each case starts from a clean slate.
function withEnv(vars, fn) {
  const saved = Object.fromEntries(RECORDING_ENV.map((k) => [k, process.env[k]]));
  RECORDING_ENV.forEach((k) => delete process.env[k]);
  Object.assign(process.env, vars);
  try {
    return fn();
  } finally {
    RECORDING_ENV.forEach((k) => delete process.env[k]);
    Object.entries(saved).forEach(([k, v]) => { if (v !== undefined) process.env[k] = v; });
  }
}

// warnShadowedLegacy and warnRemovedPaceKeys write to console.warn; capture instead of
// polluting the test output, and let cases assert that the warning actually fired.
function captureWarnings(fn) {
  const original = console.warn;
  const lines = [];
  console.warn = (...args) => lines.push(args.join(' '));
  try {
    return { result: fn(), warnings: lines };
  } finally {
    console.warn = original;
  }
}

const resolve = (config, env = {}) => withEnv(env, () => captureWarnings(() => resolveSettings(config)));

test('empty config resolves to the documented defaults', () => {
  const { result } = resolve({});
  assert.deepEqual(result.recording.viewport, DEFAULTS.recording.viewport);
  assert.equal(result.recording.captions.enabled, true);
  assert.equal(result.recording.captions.locale, 'en');
  assert.equal(result.output.overwrite, false);
  assert.equal(result.recording.pace.afterClickMs, DEFAULTS.recording.pace.afterClickMs);
});

test('a higher speed shortens every waiting period', () => {
  const { result } = resolve({ recording: { speed: 'fast' } });
  assert.ok(result.recording.pace.afterClickMs < DEFAULTS.recording.pace.afterClickMs);
  assert.ok(result.recording.pace.typeCharMs < DEFAULTS.recording.pace.typeCharMs);
});

test('a lower speed lengthens every waiting period', () => {
  const { result } = resolve({ recording: { speed: 'slowest' } });
  assert.equal(result.recording.pace.afterClickMs, DEFAULTS.recording.pace.afterClickMs * 2);
});

test('speed accepts a plain number read as playback rate', () => {
  const { result } = resolve({ recording: { speed: 2 } });
  assert.equal(result.recording.pace.afterClickMs, DEFAULTS.recording.pace.afterClickMs / 2);
});

test('speed leaves interpolation counts alone: only durations scale', () => {
  const { result } = resolve({ recording: { speed: 'slow' } });
  assert.equal(result.recording.pace.jitter, DEFAULTS.recording.pace.jitter);
  assert.equal(result.recording.pace.cursorFrameMs > 0, true);
});

test('speed outside the supported range is rejected instead of silently clamped', () => {
  assert.throws(() => resolve({ recording: { speed: 99 } }), /99/);
  assert.throws(() => resolve({ recording: { speed: 0 } }));
});

test('an unknown speed name is rejected', () => {
  assert.throws(() => resolve({ recording: { speed: 'turbo' } }), /turbo/);
});

test('a hand written pace value is absolute and not scaled again by speed', () => {
  const { result } = resolve({ recording: { speed: 'fast', pace: { afterClickMs: 1200 } } });
  assert.equal(result.recording.pace.afterClickMs, 1200);
  // Keys the config did not mention still follow speed.
  assert.ok(result.recording.pace.afterTypeMs < DEFAULTS.recording.pace.afterTypeMs);
});

test('scope keys win over the legacy root keys, and the clash is reported', () => {
  const { result, warnings } = resolve({
    locale: 'vi-VN',
    recording: { locale: 'ja-JP' },
  });
  assert.equal(result.recording.locale, 'ja-JP');
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /locale/);
});

test('a legacy root key still applies when no scope key covers it', () => {
  const { result, warnings } = resolve({ locale: 'vi-VN', accountStore: 'tmp/accounts.json' });
  assert.equal(result.recording.locale, 'vi-VN');
  assert.equal(result.output.accountStore, 'tmp/accounts.json');
  assert.equal(warnings.length, 0);
});

test('a pace key that no longer exists is reported rather than silently dropped', () => {
  const { warnings } = resolve({ recording: { pace: { cursorSteps: 40 } } });
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /cursorSteps/);
});

test('environment variables beat the project config', () => {
  const { result } = resolve(
    { recording: { headed: false, browserChannel: 'chrome', captions: { enabled: true, locale: 'en' } }, output: { overwrite: false } },
    { HEADED: '1', BROWSER_CHANNEL: 'msedge', EVIDENCE_OVERWRITE: '1', CAPTIONS: 'off', CAPTION_LOCALE: 'ja' },
  );
  assert.equal(result.recording.headed, true);
  assert.equal(result.recording.browserChannel, 'msedge');
  assert.equal(result.output.overwrite, true);
  assert.equal(result.recording.captions.enabled, false);
  assert.equal(result.recording.captions.locale, 'ja');
});

test('CAPTIONS accepts the spellings people actually type', () => {
  for (const on of ['1', 'on', 'true', 'yes', 'ON']) {
    assert.equal(resolve({}, { CAPTIONS: on }).result.recording.captions.enabled, true, on);
  }
  for (const off of ['0', 'off', 'false', 'no', 'Off']) {
    assert.equal(resolve({}, { CAPTIONS: off }).result.recording.captions.enabled, false, off);
  }
});

test('a misspelled CAPTIONS value fails loudly instead of meaning "off"', () => {
  assert.throws(() => resolve({}, { CAPTIONS: 'onn' }), /onn/);
});

test('an unsupported caption locale is rejected, from the config and from the environment', () => {
  assert.throws(() => resolve({ recording: { captions: { enabled: true, locale: 'fr' } } }), /fr/);
  assert.throws(() => resolve({}, { CAPTION_LOCALE: 'fr' }), /fr/);
});

test('resolveSettings does not mutate the shared defaults', () => {
  resolve({ recording: { speed: 'slowest', pace: { afterClickMs: 5000 } }, output: { overwrite: true } });
  assert.equal(DEFAULTS.recording.pace.afterClickMs, 800);
  assert.equal(DEFAULTS.output.overwrite, false);
});

// ---------- the defaults are not written to ----------

test('resolving twice gives the same answer, whatever the first run derived', () => {
  // The settings object is written to after it is built — an environment variable overriding a
  // value, a derived one filled in — and a shallow copy would leave those writes landing in the
  // module's own defaults. The second run would then read what the first one decided.
  const tall = resolveSettings({ recording: { viewport: { width: 900, height: 800 } } });
  const short = resolveSettings({ recording: { viewport: { width: 900, height: 480 } } });
  const tallAgain = resolveSettings({ recording: { viewport: { width: 900, height: 800 } } });

  assert.equal(tallAgain.recording.terminal.height, tall.recording.terminal.height);
  assert.ok(short.recording.terminal.height < tall.recording.terminal.height);
  assert.equal(DEFAULTS.recording.terminal.height, null);
});

test('a project override does not reach into the defaults either', () => {
  resolveSettings({ recording: { speed: 'slowest', captions: { enabled: false, locale: 'ja' } } });
  assert.equal(DEFAULTS.recording.captions.enabled, true);
  assert.equal(DEFAULTS.recording.captions.locale, 'en');
});

test('a regular expression survives being merged, rather than becoming a plain object', () => {
  const settings = resolveSettings({ recording: { terminal: { scrub: [/ghp_[A-Za-z0-9]{4,}/g] } } });
  assert.ok(settings.recording.terminal.scrub[0] instanceof RegExp);
});

// ---------- the panel height follows the frame ----------

test('the terminal panel is a share of the frame, not a fixed number of pixels', () => {
  // A fixed 300px default made a 480px frame refuse to record at all, even for a take that
  // never opens a terminal.
  const small = resolveSettings({ recording: { viewport: { width: 800, height: 480 } } });
  assert.ok(small.recording.terminal.height < 300);
  assert.ok(small.recording.terminal.height > 0);
});

test('a height written down by the project is still checked against the frame', () => {
  assert.throws(
    () => resolveSettings({ recording: { viewport: { width: 800, height: 480 }, terminal: { height: 400 } } }),
    /480px frame/,
  );
});
