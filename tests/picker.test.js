// The real file picker is driven by keys posted to the operating system, and the one outcome
// that must never happen is those keys — a Return above all — reaching whatever else is in front. That, and which way upload() goes, are decisions that need no screen to check.
const test = require('node:test');
const assert = require('node:assert/strict');

const {
  chooseFile, newWindowOver, uploadRoute,
} = require('../src/skills/recording/scripts/picker');

const BROWSER = 4242;
const RECT = { x: 0, y: 0, width: 800, height: 600 };
const PANEL = { id: 9, pid: BROWSER, layer: 0, x: 100, y: 40, width: 600, height: 400 };

// The operating system, reduced to what chooseFile asks of it. `front` is who has the keyboard;
// `opens` is whether clicking the field puts a picker up; `closes` is whether Return takes it
// down; `fits` is whether the picker can be made small enough for the window.
function fakeSystem({ front = BROWSER, opens = true, closes = true, fits = true, selectsOn = 'right' } = {}) {
  const state = { open: false, typed: [], activated: [], field: false, text: null, selected: false };
  return {
    state,
    io: {
      windows: () => (state.open ? [PANEL] : []),
      frontmostPid: () => (typeof front === 'function' ? front(state) : front),
      activate: (pid) => state.activated.push(pid),
      fit: () => ({ window: RECT, sheet: fits ? PANEL : { ...PANEL, height: 900 } }),
      focusedRole: () => (state.field ? 'AXTextField' : 'AXList'),
      setText: (pid, text) => { state.text = text; return state.field; },
      where: () => (state.text && !state.field ? 'in' : 'home'),
      canConfirm: () => state.selected,
      keys(pid, actions) {
        state.typed.push(actions);
        const [{ key, with: modifiers }] = actions;
        if (key === 'g' && modifiers) state.field = true;
        else if (key === 'return' && state.field) state.field = false;
        else if (key === 'return' && closes) state.open = false;
        if (key === selectsOn) state.selected = true;
        if (key === 'escape') state.open = false;
        return true;
      },
    },
    open: async () => { if (opens) state.open = true; },
  };
}

const keysOf = (state) => state.typed.map(([{ key }]) => key);

const run = (sys, extra = {}) => chooseFile({
  pid: BROWSER, rect: RECT, folder: '/tmp/in', holdMs: 0, sleep: async () => {},
  io: sys.io, open: sys.open, openTimeoutMs: 200, fieldTimeoutMs: 200, landTimeoutMs: 200,
  selectTimeoutMs: 100, closeTimeoutMs: 200,
  suggestMs: 0, settleMs: 0, pollMs: 50,
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

test('only a new window over the browser counts as the picker', () => {
  const old = { ...PANEL, id: 1 };
  const elsewhere = { ...PANEL, id: 2, x: 2000 };
  const banner = { ...PANEL, id: 3, layer: 23 };
  assert.equal(newWindowOver([old], [old, elsewhere, banner], RECT), null);
  assert.equal(newWindowOver([old], [old, PANEL], RECT), PANEL);
});

test('the picker goes to the folder, then the file is selected in it, then confirmed', async () => {
  const sys = fakeSystem();
  const order = [];
  await run(sys, {
    onOpened: () => order.push('opened'),
    onLanded: () => order.push(`landed:${keysOf(sys.state).join(',')}`),
  });
  // The cut ends once the picker is in the folder: selecting the file is part of the video
  assert.deepEqual(order, ['opened', 'landed:g,return']);
  // Right selects it in a picker showing columns, so Down is never sent
  assert.deepEqual(keysOf(sys.state), ['g', 'return', 'right', 'return']);
  // Set, not typed: the path never goes through the keyboard
  assert.equal(sys.state.text, '/tmp/in/');
  assert.equal(sys.state.open, false);
});

test('a picker the Accessibility API cannot find is not reported as too big', async () => {
  const sys = fakeSystem();
  sys.io.fit = () => null;
  await assert.rejects(run(sys), (error) => !/viewport/.test(error.message));
  assert.deepEqual(keysOf(sys.state), ['escape']);
});

test('a picker showing a list selects with Down once Right changed nothing', async () => {
  const sys = fakeSystem({ selectsOn: 'down' });
  await run(sys);
  assert.deepEqual(keysOf(sys.state), ['g', 'return', 'right', 'down', 'return']);
});

test('a file that cannot be selected is never confirmed', async () => {
  const sys = fakeSystem({ selectsOn: null });
  await assert.rejects(run(sys), /could not select/);
  assert.equal(keysOf(sys.state).filter((key) => key === 'return').length, 1);
});

test('a picker that never reaches the folder is not taken as having arrived', async () => {
  const sys = fakeSystem();
  sys.io.where = () => 'home';
  const landed = [];
  await assert.rejects(run(sys, { onLanded: () => landed.push(true) }), /did not get there/);
  assert.deepEqual(landed, []);
});

test('a picker too big for the window stops the take before anything is sent', async () => {
  const sys = fakeSystem({ fits: false });
  await assert.rejects(run(sys), /does not fit/);
  assert.deepEqual(keysOf(sys.state), ['escape']);
});

test('nothing is typed while another application has the keyboard', async () => {
  const sys = fakeSystem({ front: 777 });
  await assert.rejects(run(sys), /another application/);
  assert.deepEqual(sys.state.typed, []);
});

test('an application that comes to the front mid-way gets no Return and no Escape', async () => {
  // In front for Go to Folder, gone before the Return that would follow it
  const sys = fakeSystem({ front: (state) => (state.typed.length ? 777 : BROWSER) });
  await assert.rejects(run(sys), /going to the folder/);
  assert.deepEqual(keysOf(sys.state), ['g']);
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
