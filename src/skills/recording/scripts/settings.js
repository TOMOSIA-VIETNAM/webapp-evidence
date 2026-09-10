// Merge project configuration with the skill defaults.
//
// Configuration is split into scopes so that new groups can be added later without touching the
// existing ones:
//   apps      — per app: baseUrl, prepare, login
//   recording — everything that affects the recording (frame, pacing, video quality)
//   output    — where results go and what happens to older ones
//
// Legacy root keys (locale, accountStore, browserChannel) are still accepted so configs written
// against an earlier version keep working; the new scope wins when both are present.
const { LOCALE_KEYS, assertLocale } = require('./captions');

const DEFAULTS = {
  recording: {
    viewport: { width: 1280, height: 800 },
    locale: 'en-US',
    // Caption sentences shown in the video at the moments the recording cannot speak for itself
    // (the <select> dropdown, the file picker — drawn by the operating system, so they never make
    // it into the frame). `locale` is the language the MR reviewer reads, not the app's language.
    captions: { enabled: true, locale: 'en' },
    browserChannel: 'chrome',
    headed: false,
    // Open DevTools with the browser. Only meaningful alongside a window capture — it is
    // browser UI, so a recording of page content cannot contain it either way.
    devtools: false,
    // How fast the actions run in the video. Accepts a preset name ('slowest' | 'slow' | 'normal'
    // | 'fast') or a number read like a video player's playback rate: 1 = normal, 0.5 = half
    // speed, 1.5 = one and a half times faster. A bigger number is always faster, exactly as the
    // key name says.
    speed: 'normal',
    // Pacing for the viewer, not for the machine. Slower than real operation because the viewer
    // needs time to see where the cursor is going before seeing the result.
    pace: {
      // Cursor: movement time is derived from distance and target size (Fitts's law) rather than
      // being fixed, so what is declared here are coefficients, not a step count.
      cursorFrameMs: 16,      // interval between two frames while drawing the path
      cursorBaseMs: 90,       // the fixed part of a single move
      cursorPerBitMs: 95,     // added per bit of difficulty of that move (smaller and farther target)
      cursorMinMs: 120,       // even sliding to the element right next door is no faster than this
      cursorMaxMs: 900,       // even crossing the whole screen takes no longer than this
      cursorSettleMs: 110,    // the correction after overshooting the target (only on long moves)
      beforeClickMs: 250,     // aiming before the click; short slides aim faster automatically
      clickHoldMs: 85,        // how long the mouse button is held
      afterClickQuickMs: 220, // pause: 'quick' — a click that only moves on, nothing to look at
      afterClickMs: 800,      // the default pause (the click helper can override it per call)
      afterClickObserveMs: 1700, // pause: 'observe' — the result on screen has to be read
      typeCharMs: 75,         // average time per character while typing
      afterTypeMs: 700,
      selectStepMs: 220,      // time per option change inside a select
      afterSelectMs: 900,
      afterUploadMs: 1200,    // hold so the file name has time to appear
      afterCommandMs: 1600,   // hold after a command finishes, so its output can be read
      dialogHoldMs: 2600,     // how long a browser dialog stays up before it is answered
      beforeHotkeyMs: 450,    // the key hint overlay appears first, then the keys are pressed
      hotkeyHoldMs: 1400,     // keep the overlay up after the press, long enough to read both the keys and the result
      afterHotkeyMs: 900,     // pause after the overlay goes away
      // A caption stays up long enough to read, which depends on how much there is to read: the
      // floor below, plus reading time for the sentence, capped so one long caption cannot stall
      // the take. See readingTime() in record.js.
      noteHoldMs: 1800,       // the shortest a caption is ever shown, however short the sentence
      noteHoldMaxMs: 6500,    // and the longest, however long it is
      noteCharsPerSec: 18,    // reading speed for an alphabetic script
      noteCjkCharsPerSec: 9,  // Japanese and Chinese carry more meaning per character, so fewer per second
      settleMs: 600,          // wait after the page finishes loading, before the clock starts
      tailMs: 900,            // extra hold at the end so the last frame is not cut short
      // Every wait above is jittered around its declared value by this ratio. Machine-even pacing
      // is the clearest giveaway of a bot-driven video. Set it to 0 when two takes have to match
      // frame for frame.
      jitter: 0.18,
    },
    video: { crf: 26, preset: 'slow' },
    // What the frame of the recording is.
    //   'page'   Playwright records the page. Headless, no permission, runs in CI.
    //   'window' ffmpeg records the browser window, so what the operating system draws inside it
    //            — the file picker, a JavaScript dialog, the print sheet — is in the video too.
    //   'screen' the whole display, and everything else that happens to be on it.
    // Anything but 'page' records what is on someone's screen, so the runner refuses to start
    // one without SCREEN_CAPTURE=1.
    capture: 'page',
    screenCapture: {
      framerate: 30,
      display: 0,             // which display, when there is more than one
      // Between the answer given in the terminal and the first frame: time to take a hand off
      // the keyboard. The notice that asks for that answer is shown by announce.js, before the
      // question, so by the time a recording starts it has already been read and dismissed.
      countdownSeconds: 3,
      // A ceiling on the recording itself. A runner that dies partway cannot then leave a screen
      // recorder running until the disk fills; a take that needs longer says so and raises it.
      maxSeconds: 600,
    },
    // The shell shown in the panel over the page. It runs on the machine doing the recording,
    // so a step script can prove what happened behind the browser — a job that was enqueued, a
    // file that was written — without recording the whole screen.
    terminal: {
      // The bottom strip of the frame the panel occupies. null derives it from the viewport, so
      // a small frame does not have to override a number it never asked for — and a take that
      // never opens a terminal is never stopped by one.
      height: null,
      fontSize: 13,
      // --norc keeps the take independent of whoever's dotfiles are on the machine. The
      // environment is still inherited, so a PATH set up by rbenv, nvm or asdf applies.
      shell: ['bash', '--norc', '--noprofile', '-s'],
      cwd: undefined,        // defaults to the project root
      env: {},
      // Extra patterns blacked out of the panel, the runbook and the screenshots. The password
      // of the signed-in account is covered already; this is for whatever else the project's
      // own commands print.
      scrub: [],
      title: undefined,      // the label in the panel's title bar; defaults to the shell's name
    },
  },
  output: {
    // false: keep older takes by moving them into evidence/v1, v2… before recording a new one.
    // A take is evidence already sent along with the MR; overwriting it loses the comparison for
    // good.
    overwrite: false,
    accountStore: '.evidence/accounts.json',
  },
};

// Values are speed multipliers, on the same scale as a number the user writes themselves
const SPEED_PRESETS = { slowest: 0.5, slow: 0.67, normal: 1, fast: 1.67 };
const SPEED_RANGE = { min: 0.2, max: 5 };

const isObject = (v) => v && typeof v === 'object' && !Array.isArray(v);

// A plain object is one worth merging into and copying. A RegExp (recording.terminal.scrub) and
// a Date are objects too, and copying them field by field would quietly turn them into something
// that is no longer either.
const isPlain = (v) => isObject(v)
  && (Object.getPrototypeOf(v) === Object.prototype || Object.getPrototypeOf(v) === null);

// DEFAULTS is a module-level object, and the settings handed back are written to afterwards —
// an environment variable overrides a value, a derived one is filled in. A shallow copy leaves
// every nested scope pointing at DEFAULTS itself, so the first run writes into the defaults and
// the second run reads what the first one decided. That is a bug that only shows up in the
// second run, which in practice means only ever in the tests.
function clone(value) {
  if (Array.isArray(value)) return value.map(clone);
  if (!isPlain(value)) return value;
  return Object.fromEntries(Object.entries(value).map(([key, inner]) => [key, clone(inner)]));
}

// speed scales every duration in pace. The interpolation step count stays as it is, because it
// decides whether the cursor path looks smooth, not whether it is fast or slow.
function speedToRate(speed) {
  if (typeof speed === 'number') {
    if (!Number.isFinite(speed) || speed < SPEED_RANGE.min || speed > SPEED_RANGE.max) {
      throw new Error(
        `recording.speed is out of range: ${speed}\n` +
        `The number must be within ${SPEED_RANGE.min}–${SPEED_RANGE.max} (1 = normal, ` +
        '0.5 = half speed, 1.5 = one and a half times faster).'
      );
    }
    return speed;
  }
  const rate = SPEED_PRESETS[speed];
  if (rate === undefined) {
    throw new Error(
      `recording.speed is invalid: ${JSON.stringify(speed)}\n` +
      `Use a preset name (${Object.keys(SPEED_PRESETS).join(' | ')}) ` +
      `or a number within ${SPEED_RANGE.min}–${SPEED_RANGE.max}, read as a playback rate.`
    );
  }
  return rate;
}

function applySpeed(pace, speed) {
  // Double the speed means every wait becomes half as long
  const factor = 1 / speedToRate(speed);
  if (factor === 1) return pace;
  const scaled = { ...pace };
  for (const [key, value] of Object.entries(pace)) {
    if (key.endsWith('Ms') && typeof value === 'number') scaled[key] = Math.round(value * factor);
  }
  return scaled;
}

function merge(base, override) {
  const out = clone(base);
  for (const [key, value] of Object.entries(override || {})) {
    if (value === undefined) continue;
    out[key] = isPlain(value) && isPlain(base[key]) ? merge(base[key], value) : clone(value);
  }
  return out;
}

// When a legacy root key is shadowed by the key in a scope, the value someone wrote silently has
// no effect — hardest to spot when the scope is inherited through a spread from a shared config.
function warnShadowedLegacy(config) {
  const pairs = [
    ['locale', config.locale, config.recording?.locale, 'recording.locale'],
    ['browserChannel', config.browserChannel, config.recording?.browserChannel, 'recording.browserChannel'],
    ['accountStore', config.accountStore, config.output?.accountStore, 'output.accountStore'],
  ];
  for (const [key, rootValue, scopedValue, scopedName] of pairs) {
    if (rootValue !== undefined && scopedValue !== undefined && rootValue !== scopedValue) {
      console.warn(
        `WARNING: the configuration has both \`${key}\` at the root (${JSON.stringify(rootValue)}) and ` +
        `\`${scopedName}\` (${JSON.stringify(scopedValue)}). The scope wins, the root value is ignored.\n` +
        '  When inheriting a shared config with a spread, the override has to go inside the scope: ' +
        `{ ...base, recording: { ...base.recording, ${key}: … } }`
      );
    }
  }
}

// These two keys used to decide the cursor path (step count × time per step). Movement time is
// now derived from distance, so they have nowhere left to apply — say so instead of silently
// dropping a value someone thought about before writing.
const REMOVED_PACE_KEYS = {
  cursorSteps: 'cursorFrameMs (the interval between two frames)',
  cursorStepMs: 'cursorFrameMs (the interval between two frames)',
};

function warnRemovedPaceKeys(config) {
  for (const [key, replacement] of Object.entries(REMOVED_PACE_KEYS)) {
    if (config.recording?.pace?.[key] === undefined) continue;
    console.warn(
      `WARNING: \`recording.pace.${key}\` no longer has any effect and is ignored.\n` +
      '  Cursor movement time is now derived from distance and target size ' +
      `(cursorBaseMs, cursorPerBitMs, cursorMinMs, cursorMaxMs). To change smoothness, use ${replacement}.`
    );
  }
}

// Switching on and off through an environment variable: accept the spellings people actually
// type, but report an error on a typo instead of quietly reading it as "off".
const SWITCH_ON = ['1', 'on', 'true', 'yes'];
const SWITCH_OFF = ['0', 'off', 'false', 'no'];

function parseSwitch(value, name) {
  const normalized = String(value).trim().toLowerCase();
  if (SWITCH_ON.includes(normalized)) return true;
  if (SWITCH_OFF.includes(normalized)) return false;
  throw new Error(
    `${name} is invalid: ${JSON.stringify(value)}\n` +
    `Use ${SWITCH_ON.join('/')} to turn it on, ${SWITCH_OFF.join('/')} to turn it off.`
  );
}

// The panel covers the bottom of the frame, so its height is not a free choice: leave it too
// tall and the app being recorded has nowhere left to show what is being proven.
const MIN_PANEL_ROWS_HEIGHT = 120;
const MAX_PANEL_SHARE = 0.6;

function resolveTerminal({ terminal, viewport }) {
  const fail = (key, message) => {
    throw new Error(`recording.terminal.${key} ${message}`);
  };

  // Derived rather than fixed: the panel should be a share of the frame, and the fixed default
  // it used to have made a 480px frame refuse to record at all.
  if (terminal.height === null || terminal.height === undefined) {
    terminal.height = Math.max(
      MIN_PANEL_ROWS_HEIGHT,
      Math.min(300, Math.round(viewport.height * 0.4)),
    );
  }

  if (!Number.isFinite(terminal.height) || terminal.height < MIN_PANEL_ROWS_HEIGHT) {
    fail('height', `must be at least ${MIN_PANEL_ROWS_HEIGHT}px, got ${JSON.stringify(terminal.height)}`);
  }
  const ceiling = Math.round(viewport.height * MAX_PANEL_SHARE);
  if (terminal.height > ceiling) {
    fail('height', `is ${terminal.height}px, more than ${ceiling}px of the ${viewport.height}px frame. ` +
      'The application being recorded needs the rest of it.');
  }
  if (!Number.isFinite(terminal.fontSize) || terminal.fontSize < 9 || terminal.fontSize > 24) {
    fail('fontSize', `must be between 9 and 24, got ${JSON.stringify(terminal.fontSize)}`);
  }
  if (!Array.isArray(terminal.shell) || !terminal.shell.length
      || terminal.shell.some((part) => typeof part !== 'string')) {
    fail('shell', 'must be a non-empty array of strings, for example [\'bash\', \'--norc\', \'-s\']');
  }
  terminal.scrub.forEach((pattern, index) => {
    if (!(pattern instanceof RegExp)) {
      fail(`scrub[${index}]`, `must be a regular expression, got ${typeof pattern}`);
    }
  });
}

const CAPTURE_MODES = ['page', 'window', 'screen'];

function assertCapture({ capture, screenCapture }) {
  if (!CAPTURE_MODES.includes(capture)) {
    throw new Error(
      `recording.capture is invalid: ${JSON.stringify(capture)}\n` +
      `Use one of ${CAPTURE_MODES.join(' | ')}. 'page' records the page and runs headless; the ` +
      'others record what is on a screen.'
    );
  }
  if (!Number.isInteger(screenCapture.framerate) || screenCapture.framerate < 5 || screenCapture.framerate > 60) {
    throw new Error(
      `recording.screenCapture.framerate must be a whole number between 5 and 60, got ` +
      `${JSON.stringify(screenCapture.framerate)}`
    );
  }
  if (!Number.isInteger(screenCapture.display) || screenCapture.display < 0) {
    throw new Error(
      `recording.screenCapture.display must be a display number from 0 upwards, got ` +
      `${JSON.stringify(screenCapture.display)}`
    );
  }
  if (!Number.isFinite(screenCapture.maxSeconds) || screenCapture.maxSeconds < 10) {
    throw new Error(
      `recording.screenCapture.maxSeconds must be at least 10, got ` +
      `${JSON.stringify(screenCapture.maxSeconds)}`
    );
  }
  if (!Number.isFinite(screenCapture.countdownSeconds) || screenCapture.countdownSeconds < 0) {
    throw new Error(
      `recording.screenCapture.countdownSeconds must not be negative, got ` +
      `${JSON.stringify(screenCapture.countdownSeconds)}`
    );
  }
}

function resolveSettings(config) {
  warnShadowedLegacy(config);
  warnRemovedPaceKeys(config);
  const legacy = {
    recording: {
      locale: config.locale,
      browserChannel: config.browserChannel,
    },
    output: {
      accountStore: config.accountStore,
    },
  };

  // speed scales the defaults first, then the pace the user declared is layered on top — the
  // values they wrote themselves are absolute, and are not multiplied a second time.
  const speed = config.recording?.speed ?? DEFAULTS.recording.speed;
  const base = merge(DEFAULTS, {
    recording: { pace: applySpeed(DEFAULTS.recording.pace, speed) },
  });

  const settings = merge(merge(base, legacy), {
    recording: config.recording,
    output: config.output,
  });

  // Environment variables are the decision of whoever is running right now, and beat any config
  if (process.env.HEADED === '1') settings.recording.headed = true;
  if (process.env.BROWSER_CHANNEL) settings.recording.browserChannel = process.env.BROWSER_CHANNEL;
  if (process.env.EVIDENCE_OVERWRITE === '1') settings.output.overwrite = true;
  if (process.env.CAPTURE) settings.recording.capture = process.env.CAPTURE;
  if (process.env.CAPTIONS) {
    settings.recording.captions.enabled = parseSwitch(process.env.CAPTIONS, 'CAPTIONS');
  }
  if (process.env.CAPTION_LOCALE) {
    settings.recording.captions.locale = assertLocale(process.env.CAPTION_LOCALE, 'CAPTION_LOCALE');
  }
  assertLocale(settings.recording.captions.locale, 'recording.captions.locale');
  resolveTerminal(settings.recording);
  assertCapture(settings.recording);

  // A hidden window has nothing on a screen to record, so asking for one settles the other
  // question too. Left as a contradiction it would produce a video of the desktop.
  if (settings.recording.capture !== 'page') settings.recording.headed = true;

  return settings;
}

module.exports = { DEFAULTS, resolveSettings, LOCALE_KEYS };
