// A screen take takes the machine over, so it waits for the person at it to leave it alone, and
// waits again — rather than fighting them for the pointer — when they touch it mid-take. These
// drive that rule with a clock of their own: no screen, no python, no input watcher.
const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createHandsOff, holdWhenTouched, RUNNER_INPUT_SLACK_MS,
} = require('../src/skills/recording/scripts/idle');

// A clock that only moves when the gate sleeps, and a script of touches on it: each entry is the
// moment someone pressed a key or moved the mouse.
function machine(touches = []) {
  let t = 100000;
  const extra = [];
  const lastInputAt = () => {
    const past = [...touches, ...extra].filter((at) => at <= t);
    return past.length ? Math.max(...past) : null;
  };
  return {
    now: () => t,
    sleep: async (ms) => { t += ms; },
    lastInputAt,
    touch: (at = t) => extra.push(at),
    get t() { return t; },
  };
}

const gate = (m, more = {}) => createHandsOff({
  seconds: 3, lastInputAt: m.lastInputAt, now: m.now, sleep: m.sleep, ...more,
});

test('someone already away from the machine still gets the whole countdown to see it coming', async () => {
  const m = machine([100000 - 60000]);
  const shown = [];
  const start = m.t;
  await gate(m, { onCountdown: (s) => shown.push(s) }).wait();
  assert.equal(m.t - start, 3000);
  assert.deepEqual(shown, [3, 2, 1]);
});

test('a touch during the countdown starts it again', async () => {
  const m = machine([100000 + 1500]);
  const start = m.t;
  await gate(m).wait();
  assert.equal(m.t - start, 1500 + 3000);
});

test('someone using the machine is never overridden', async () => {
  // A key every second for ten seconds
  const m = machine(Array.from({ length: 10 }, (_, i) => 100000 + i * 1000));
  await gate(m).wait();
  assert.ok(m.t >= 100000 + 9000 + 3000);
});

test('an unknown idle time does not hold a take forever', async () => {
  const m = machine();
  const start = m.t;
  await createHandsOff({ seconds: 3, lastInputAt: () => null, now: m.now, sleep: m.sleep }).wait();
  assert.equal(m.t - start, 3000);
});

test('the first wait is never skipped, and later ones only when someone touched the machine', async () => {
  const m = machine();
  const owned = [];
  const g = gate(m, { onOwned: () => owned.push(m.t) });
  assert.equal(g.touched(), true);
  await g.wait();
  assert.equal(owned.length, 1);
  assert.equal(g.touched(), false);
  m.touch(m.t + 10);
  await m.sleep(20);
  assert.equal(g.touched(), true);
});

test('keys the runner posted itself are not a person', async () => {
  const m = machine();
  const g = gate(m);
  await g.wait();
  await m.sleep(500);
  m.touch();               // the file picker's keystrokes
  g.runnerInput();
  await m.sleep(RUNNER_INPUT_SLACK_MS - 50);
  assert.equal(g.touched(), false);
  await m.sleep(1000);
  m.touch();               // and now a person
  assert.equal(g.touched(), true);
});

test('an action waits while someone uses the machine, and the wait is bracketed for the cut', async () => {
  const m = machine();
  const g = gate(m);
  await g.wait();
  const events = [];
  const scope = holdWhenTouched({
    click: async (what) => { events.push(['click', what, m.t]); return what; },
    mark: (label) => { events.push(['mark', label]); },
    page: { not: 'a function' },
  }, {
    handsOff: g,
    onHold: async (over) => { events.push([over ? 'resume' : 'hold', m.t]); },
  });

  assert.equal(await scope.click('a'), 'a');
  assert.equal(events.at(-1)[0], 'click');

  // mark() stays synchronous: step scripts call it without await
  assert.equal(scope.mark('label'), undefined);
  assert.deepEqual(scope.page, { not: 'a function' });

  m.touch(m.t + 100);
  await m.sleep(200);
  const touchedAt = m.t - 100;
  await scope.click('b');
  const [hold, resume, click] = events.slice(-3);
  assert.equal(hold[0], 'hold');
  assert.equal(resume[0], 'resume');
  assert.ok(resume[1] - touchedAt >= 3000);
  assert.deepEqual(click.slice(0, 2), ['click', 'b']);

  // Nobody touched it since: the next action goes straight on
  const before = events.length;
  await scope.click('c');
  assert.equal(events.length, before + 1);
});

test('the terminal\'s actions wait like the ones beside them, and a class instance is left alone', async () => {
  const m = machine();
  const g = gate(m);
  await g.wait();
  const events = [];
  class Page { async goto() { events.push('goto'); } }
  const page = new Page();
  const scope = holdWhenTouched({
    term: {
      run: async (command) => { events.push(['run', command, m.t]); return command; },
      isOpen: () => true,
    },
    page,
  }, {
    handsOff: g,
    onHold: async (over) => { events.push(over ? 'resume' : 'hold'); },
  });

  assert.equal(scope.page, page);
  assert.equal(scope.term.isOpen(), true);

  m.touch(m.t + 100);
  await m.sleep(200);
  assert.equal(await scope.term.run('ls'), 'ls');
  assert.deepEqual(events.slice(0, 2), ['hold', 'resume']);
  assert.equal(events[2][0], 'run');
});
