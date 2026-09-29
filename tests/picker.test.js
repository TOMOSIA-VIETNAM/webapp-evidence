// The real file picker is driven by keys posted to the operating system, and the one outcome
// that must never happen is those keys — a file path followed by Return — reaching whatever else
// is in front. That, and which way upload() goes, are decisions that need no screen to check.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const {
  chooseFile, goToFileKeys, newWindowOver, uploadRoute,
} = require('../src/skills/recording/scripts/picker');

const BROWSER = 4242;
const RECT = { x: 0, y: 0, width: 800, height: 600 };
const PANEL = { id: 9, pid: BROWSER, layer: 0, x: 100, y: 40, width: 600, height: 400 };

// The operating system, reduced to what chooseFile asks of it. `front` is who has the keyboard;
// `opens` is whether clicking the field puts a picker up; `closes` is whether Return takes it down.
function fakeSystem({ front = BROWSER, opens = true, closes = true } = {}) {
  const state = { open: false, typed: [], activated: [] };
  return {
    state,
    io: {
      windows: () => (state.open ? [PANEL] : []),
      frontmostPid: () => (typeof front === 'function' ? front(state) : front),
      activate: (pid) => state.activated.push(pid),
      keys(pid, actions) {
        state.typed.push(actions);
        if (actions.some((a) => a.key === 'return' && !a.with) && actions.length === 1 && closes) state.open = false;
        if (actions.some((a) => a.key === 'escape')) state.open = false;
        return true;
      },
    },
    open: async () => { if (opens) state.open = true; },
  };
}

const run = (sys, extra = {}) => chooseFile({
  pid: BROWSER, rect: RECT, file: '/tmp/in/sample.csv', holdMs: 0, sleep: async () => {},
  io: sys.io, open: sys.open, openTimeoutMs: 200, closeTimeoutMs: 200, settleMs: 0, pollMs: 50,
  ...extra,
});

test('a page recording never opens the picker, whatever the machine allows', () => {
  assert.equal(uploadRoute({ mode: 'page', pickerAvailable: true }), 'intercept');
  assert.equal(uploadRoute({ mode: 'page', pickerAvailable: false }), 'intercept');
});

test('a window or screen recording opens it only when keys can be sent to it', () => {
  assert.equal(uploadRoute({ mode: 'window', pickerAvailable: false }), 'intercept');
  assert.equal(uploadRoute({ mode: 'window', pickerAvailable: true }), 'picker');
  assert.equal(uploadRoute({ mode: 'screen', pickerAvailable: true }), 'picker');
});

test('the picker is sent to the file itself, in one jump, over whatever the field held before', () => {
  const keys = goToFileKeys('relative/sample.csv');
  assert.deepEqual(keys[0], { key: 'g', with: ['cmd', 'shift'] });
  assert.deepEqual(keys[2], { key: 'a', with: ['cmd'] });
  assert.equal(keys[3].text, path.resolve('relative/sample.csv'));
  assert.deepEqual(keys[keys.length - 1], { key: 'return' });
});

test('only a new window over the browser counts as the picker', () => {
  const old = { ...PANEL, id: 1 };
  const elsewhere = { ...PANEL, id: 2, x: 2000 };
  const banner = { ...PANEL, id: 3, layer: 23 };
  assert.equal(newWindowOver([old], [old, elsewhere, banner], RECT), null);
  assert.equal(newWindowOver([old], [old, PANEL], RECT), PANEL);
});

test('a picker that opens is sent to the file, held, and confirmed — in that order', async () => {
  const sys = fakeSystem();
  const order = [];
  await run(sys, { onOpened: () => order.push('opened'), onLanded: () => order.push('landed') });
  assert.deepEqual(order, ['opened', 'landed']);
  assert.equal(sys.state.typed.length, 2);
  assert.deepEqual(sys.state.typed[1], [{ key: 'return' }]);
  assert.equal(sys.state.open, false);
});

test('nothing is typed while another application has the keyboard', async () => {
  const sys = fakeSystem({ front: 777 });
  await assert.rejects(run(sys), /another application/);
  assert.deepEqual(sys.state.typed, []);
});

test('an application that comes to the front mid-way gets no Return and no Escape', async () => {
  // In front for the jump, gone before the confirmation
  const sys = fakeSystem({ front: (state) => (state.typed.length ? 777 : BROWSER) });
  await assert.rejects(run(sys), /confirming/);
  assert.equal(sys.state.typed.length, 1);
});

test('a browser not yet in front is asked to come forward before anything else', async () => {
  let asked = false;
  const sys = fakeSystem({ front: () => (asked ? BROWSER : 777) });
  sys.io.activate = () => { asked = true; };
  await run(sys);
  assert.ok(asked);
});

test('a click that opens no picker fails without typing anything', async () => {
  const sys = fakeSystem({ opens: false });
  await assert.rejects(run(sys), /no file picker opened/);
  assert.deepEqual(sys.state.typed, []);
});

test('a picker still open after the confirmation is reported, not waited on forever', async () => {
  const sys = fakeSystem({ closes: false });
  await assert.rejects(run(sys), /still open/);
});
