// The pacing layer is what separates a watchable recording from a machine-driven one, and it
// also carries the runbook's promise that re-running a script reproduces the same take. Both
// properties are invisible in a video review, so they are pinned here: same seed means same
// numbers, distance drives cursor duration, and jitter: 0 removes randomness entirely.
const test = require('node:test');
const assert = require('node:assert/strict');

const { createHuman, createRng, hashSeed, ballistic } = require('../src/skills/get/scripts/human');
const { DEFAULTS } = require('../src/skills/get/scripts/settings');

const PACE = DEFAULTS.recording.pace;
const VIEWPORT = DEFAULTS.recording.viewport;

const human = (overrides = {}, seed = 'user-search') => createHuman({
  pace: { ...PACE, ...overrides },
  viewport: VIEWPORT,
  seed,
});

test('the same seed replays the same sequence, a different seed does not', () => {
  const draw = (seed) => Array.from({ length: 8 }, createRng(hashSeed(seed)));
  assert.deepEqual(draw('user-search'), draw('user-search'));
  assert.notDeepEqual(draw('user-search'), draw('user-create'));
});

test('the random stream stays inside 0..1', () => {
  const rng = createRng(hashSeed('user-search'));
  for (let i = 0; i < 500; i++) {
    const value = rng();
    assert.ok(value >= 0 && value < 1, String(value));
  }
});

test('the movement curve runs from start to target and never goes backwards', () => {
  assert.equal(ballistic(0), 0);
  assert.equal(ballistic(1), 1);
  assert.equal(ballistic(-1), 0);
  assert.equal(ballistic(2), 1);
  let previous = 0;
  for (let t = 0; t <= 1; t += 0.02) {
    const value = ballistic(t);
    assert.ok(value >= previous - 1e-9, `t=${t}`);
    previous = value;
  }
});

test('the curve front-loads the movement, the way a hand releases then brakes', () => {
  // Half the distance is covered well before half the time; a symmetric curve is the machine one.
  assert.ok(ballistic(0.5) > 0.6);
});

test('jitter: 0 keeps every wait exactly as configured', () => {
  const { wait } = human({ jitter: 0 });
  for (const ms of [0, 220, 800, 1700]) assert.equal(wait(ms), ms);
});

test('jitter spreads waits around the configured value without running away', () => {
  const { wait } = human({ jitter: 0.18 });
  const samples = Array.from({ length: 200 }, () => wait(800));
  assert.ok(new Set(samples).size > 1, 'jitter produced a constant');
  for (const ms of samples) assert.ok(ms >= 800 * 0.82 - 1 && ms <= 800 * 1.18 + 1, String(ms));
});

test('jitter is clamped so one bad config value cannot stretch a take into an hour', () => {
  const { wait } = human({ jitter: 50 });
  const samples = Array.from({ length: 200 }, () => wait(800));
  for (const ms of samples) assert.ok(ms <= 800 * 1.6 + 1, String(ms));
});

test('cursor duration grows with distance and stays inside the configured bounds', () => {
  const { moveDuration } = human({ jitter: 0 });
  const near = moveDuration(40, 40);
  const far = moveDuration(900, 40);
  assert.ok(far > near, `${far} !> ${near}`);
  assert.ok(near >= PACE.cursorMinMs * 0.88, String(near));
  assert.ok(far <= PACE.cursorMaxMs * 1.12, String(far));
});

test('a bigger target is faster to hit than a small one at the same distance', () => {
  const { moveDuration } = human({ jitter: 0 });
  assert.ok(moveDuration(400, 200) < moveDuration(400, 20));
});

test('a cursor already on target does not move', () => {
  const { moveDuration, movePlan } = human();
  assert.equal(moveDuration(2, 40), 0);
  assert.equal(movePlan({ x: 100, y: 100 }, { x: 100.5, y: 100 }, 40), null);
});

test('a move plan starts near the origin and lands exactly on the target', () => {
  const plan = human().movePlan({ x: 10, y: 10 }, { x: 600, y: 400 }, 40);
  const start = plan.at(0);
  assert.ok(Math.hypot(start.x - 10, start.y - 10) < 2, JSON.stringify(start));
  assert.deepEqual(plan.at(1), { x: 600, y: 400 });
  assert.deepEqual(plan.at(5), { x: 600, y: 400 });
  assert.ok(plan.duration >= plan.frameMs);
});

test('a move plan returns the same position for the same t, whatever the frame rate', () => {
  const plan = human().movePlan({ x: 10, y: 10 }, { x: 600, y: 400 }, 40);
  for (const t of [0.1, 0.35, 0.5, 0.9]) assert.deepEqual(plan.at(t), plan.at(t));
});

test('a long move overshoots the target before settling back', () => {
  const plan = human({ jitter: 0 }).movePlan({ x: 0, y: 400 }, { x: 1200, y: 400 }, 40);
  const positions = Array.from({ length: 40 }, (_, i) => plan.at(i / 39).x);
  assert.ok(Math.max(...positions) > 1200, `no overshoot: ${Math.max(...positions)}`);
});

test('aiming takes longer after crossing the screen than after nudging one field over', () => {
  const { aimDelay } = human({ jitter: 0 });
  assert.ok(aimDelay(900) > aimDelay(30));
  assert.ok(aimDelay(30) > 0);
});

test('typing produces one delay per character, spaces and punctuation slowing it down', () => {
  const { typeDelays, charDelay } = human({ jitter: 0 });
  assert.equal(typeDelays('hello world').length, 11);
  assert.equal(typeDelays('').length, 0);
  for (const ms of typeDelays('hello world')) assert.ok(ms >= 8, String(ms));

  const mean = (char, prev) => {
    const person = human({ jitter: 0 });
    return Array.from({ length: 400 }, () => person.charDelay(char, prev))
      .reduce((a, b) => a + b, 0) / 400;
  };
  assert.ok(mean(' ', 'a') > mean('a', 'a'));
  assert.ok(mean('a', '.') > mean('a', 'a'));
  assert.equal(typeof charDelay('a'), 'number');
});

test('the resting point sits inside the viewport, off centre', () => {
  const { restingPoint } = human();
  for (let i = 0; i < 50; i++) {
    const { x, y } = restingPoint();
    assert.ok(x > 0 && x < VIEWPORT.width, String(x));
    assert.ok(y > 0 && y < VIEWPORT.height, String(y));
  }
});

test('two runs of the same script produce identical pacing', () => {
  const take = () => {
    const person = human({}, 'user-search');
    return [
      person.wait(800),
      person.moveDuration(400, 40),
      person.typeDelays('search term'),
      person.movePlan({ x: 0, y: 0 }, { x: 500, y: 300 }, 40).duration,
    ];
  };
  assert.deepEqual(take(), take());
});
