// Waiting for the person at the machine to leave it alone, before a screen take and during one.
//
// A take that records a window or the screen takes the machine over: the browser comes to the
// front, every other application is hidden, the pointer is parked. Nothing told the person when
// that was about to happen, so between two takes — a step failed, the agent is rewriting the
// script — they either sat waiting without knowing they could work, or went back to work and had
// the machine taken from them halfway through a sentence.
//
// So nothing is asked. The runner reads how long it has been since the last key or mouse event,
// and starts only once the machine has been left alone for `countdownSeconds`; any touch starts
// that count again. Someone away from the machine is not stopped for a confirmation, and someone
// using it is never overridden. During a take the same check sits between two actions: someone
// who touches the machine is waited for rather than fought over the pointer, and the stretch they
// spent on it is cut from the video.
//
// The idle time is the system's own, from CGEventSourceSecondsSinceLastEventType: through
// `python3` and `ctypes` like pointer.js, nothing installed. Measured on macOS 15: the runner's
// CGWarpMouseCursorPosition does not reset it, and Playwright's input goes through the browser and
// never reaches it. A key posted to the HID tap does reset it — picker.js posts those — which is
// why the runner reports its own input and anything up to that moment is not counted as a person.
const { spawn } = require('child_process');

// Printed four times a second by one long-lived process. Asking afresh before every action would
// start python each time, about 200 ms, and that lands in the video as a pause before each step.
const PROGRAM = `
import ctypes, sys, time
cg = ctypes.CDLL('/System/Library/Frameworks/ApplicationServices.framework/ApplicationServices')
cg.CGEventSourceSecondsSinceLastEventType.argtypes = [ctypes.c_int32, ctypes.c_uint32]
cg.CGEventSourceSecondsSinceLastEventType.restype = ctypes.c_double
HID_SYSTEM_STATE = 1
ANY_INPUT = 0xFFFFFFFF
try:
    while True:
        sys.stdout.write('%f\\n' % cg.CGEventSourceSecondsSinceLastEventType(HID_SYSTEM_STATE, ANY_INPUT))
        sys.stdout.flush()
        time.sleep(0.25)
except (BrokenPipeError, KeyboardInterrupt):
    pass
`;

const POLL_MS = 250;
// An event the runner posted reaches the system's counter a little after the call that posted it
// returns. Input inside this margin after the runner's own is taken to be the runner's.
const RUNNER_INPUT_SLACK_MS = 300;

const supported = () => process.platform === 'darwin';

// When the last key or mouse event happened, as a Date.now() timestamp, or null while unknown.
// Unknown is treated as nobody there: a take must not hang on a probe that failed to start.
function watchInput() {
  if (!supported()) return { lastInputAt: () => null, stop() {} };
  let last = null;
  let child;
  try {
    child = spawn('python3', ['-c', PROGRAM], { stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    return { lastInputAt: () => null, stop() {} };
  }
  let pending = '';
  child.stdout.on('data', (chunk) => {
    const lines = (pending + chunk).split('\n');
    pending = lines.pop();
    const idle = Number(lines[lines.length - 1]);
    if (lines.length && Number.isFinite(idle)) last = Date.now() - idle * 1000;
  });
  child.on('error', () => { last = null; });
  // The watcher must not be what keeps a finished runner alive
  child.unref();
  child.stdout.unref?.();
  return {
    lastInputAt: () => last,
    stop() {
      try { child.kill(); } catch { /* already gone */ }
    },
  };
}

// The rule itself, apart from where the timestamps come from, so the tests can drive it with a
// clock of their own.
//
// `wait()` returns once nobody has touched the machine for `seconds` — counted from the later of
// the call and the last touch, so there is always that long to see it coming, even for someone
// who had already left. From then on the machine is the runner's, and `touched()` says whether
// someone has used it since. `onCountdown` is told the whole seconds left each time that changes,
// and `onOwned` when the wait is over.
function createHandsOff({
  seconds, lastInputAt, now = Date.now, sleep, onCountdown = () => {}, onOwned = () => {},
  pollMs = POLL_MS,
}) {
  let runnerInputAt = -Infinity;
  let ownedSince = null;
  const personInputAt = () => {
    const at = lastInputAt();
    return at !== null && at > runnerInputAt + RUNNER_INPUT_SLACK_MS ? at : null;
  };

  return {
    // The runner has just posted input of its own; none of it up to now was a person
    runnerInput() { runnerInputAt = now(); },

    // Never handed over counts as touched: the first wait is never skipped
    touched() {
      if (ownedSince === null) return true;
      const at = personInputAt();
      return at !== null && at > ownedSince;
    },

    async wait() {
      const startedAt = now();
      let shown = null;
      for (;;) {
        const from = Math.max(startedAt, personInputAt() ?? -Infinity);
        const left = seconds * 1000 - (now() - from);
        if (left <= 0) break;
        const whole = Math.ceil(left / 1000);
        if (whole !== shown) {
          shown = whole;
          onCountdown(whole);
        }
        await sleep(Math.min(pollMs, left));
      }
      ownedSince = now();
      onOwned();
    },
  };
}

// Every function a step script is handed, made to wait first whenever someone has touched the
// machine since the take last had it to itself. Wrapped once here rather than inside each action,
// so an action added later cannot be the one that forgets. Calls between the actions themselves
// (upload() opening the picker) do not go through this, so an action is never interrupted halfway.
//
// ponytail: checked between actions only, so what someone did while a long action (a slow type())
// was still running stays in the video; a check inside the long actions is the upgrade.
//
// Only the async ones. A synchronous function such as mark() is called without `await`, so turning
// it into one that may wait would hand the step script a promise it never waits for. A plain
// object of actions (`term`) is held like the actions beside it; a class instance — Playwright's
// `page` — is handed over as it is, so `page.*` called directly from a step script is not held.
//
// `onHold` brackets the wait: called with `false` when it begins, and with `true` once the
// machine is the runner's again, so the caller can cut that stretch and put the frame back.
const isAsync = (fn) => typeof fn === 'function' && fn.constructor.name === 'AsyncFunction';
const isPlain = (v) => v !== null && typeof v === 'object' && Object.getPrototypeOf(v) === Object.prototype;

function holdWhenTouched(scope, options) {
  const { handsOff, onHold } = options;
  const held = {};
  for (const [name, value] of Object.entries(scope)) {
    if (isPlain(value)) {
      held[name] = holdWhenTouched(value, options);
      continue;
    }
    held[name] = !isAsync(value) ? value : async (...args) => {
      if (handsOff.touched()) {
        await onHold(false);
        await handsOff.wait();
        await onHold(true);
      }
      return value.apply(scope, args);
    };
  }
  return held;
}

module.exports = { watchInput, createHandsOff, holdWhenTouched, RUNNER_INPUT_SLACK_MS };
