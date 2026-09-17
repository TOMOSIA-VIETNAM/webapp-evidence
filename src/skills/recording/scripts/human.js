// Human-like pacing: cursor paths, waits, typing speed.
//
// A machine operates with machine-even pacing — every click exactly 800ms apart, the cursor
// travelling in a straight line in 312ms no matter how far. A viewer cannot name what is wrong,
// they just see a "machine-recorded" video. Three things make the difference, in order of how
// noticeable they are:
//   1. Uneven waits — each one off by a little.
//   2. Movement time that depends on distance and target size (Fitts's law).
//   3. A slightly curved path, accelerating fast then decelerating, and on long moves
//      overshooting the target a little before correcting back — the way a human hand drives
//      a mouse.
//
// The randomness here is seeded from the step script name: the same step script gets the same
// pacing deviations on every take, so the runbook keeps its promise that "running it again
// produces this exact take".

// mulberry32: good enough for jittering pacing, and more importantly reproducible.
function createRng(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(text) {
  let hash = 2166136261;
  for (let i = 0; i < String(text).length; i++) {
    hash ^= String(text).charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

// The velocity of a mouse move: a fast burst over roughly the first fifth of the time, then
// decelerating for the rest. Symmetry (speeding up and slowing down by equal amounts) is the
// pacing of a machine, not of a hand.
const ACCEL_T = 0.22;   // the fraction of the time spent in the burst phase
const ACCEL_D = 0.18;   // the fraction of the distance covered during that phase
function ballistic(t) {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  if (t < ACCEL_T) return ACCEL_D * (t / ACCEL_T) ** 2;
  return ACCEL_D + (1 - ACCEL_D) * (1 - (1 - (t - ACCEL_T) / (1 - ACCEL_T)) ** 2.4);
}

function createHuman({ pace, viewport, seed }) {
  const rng = createRng(hashSeed(seed || 'evidence'));
  const jitterRatio = Math.max(0, Math.min(pace.jitter ?? 0, 0.6));

  const between = (min, max) => min + rng() * (max - min);

  // Waits deviate a little around the configured value. `jitter: 0` turns it off entirely, for
  // when two takes have to be compared frame by frame.
  const wait = (ms) => {
    if (!ms || !jitterRatio) return Math.round(ms || 0);
    return Math.max(0, Math.round(ms * (1 + between(-jitterRatio, jitterRatio))));
  };

  // Fitts's law: the smaller and the farther the target, the longer the hand has to travel. This
  // is why a 40px slide to the neighbouring cell cannot take the same time as a 900px crossing to
  // the corner of the screen.
  const moveDuration = (dist, targetSize) => {
    if (dist < 4) return 0;
    const width = Math.max(16, Math.min(targetSize || 40, 220));
    const bits = Math.log2((2 * dist) / width + 1);
    const raw = pace.cursorBaseMs + pace.cursorPerBitMs * bits;
    return Math.round(Math.max(pace.cursorMinMs, Math.min(raw, pace.cursorMaxMs)) * (1 + between(-0.12, 0.12)));
  };

  // The plan for one move: the total duration and the cursor position at each point t (0 → 1).
  //
  // It returns a position function rather than a list of frames, because each page.mouse.move
  // command costs about 17ms of round trip to the browser — more than the interval between two
  // frames. Pumping a fixed list through would make every move longer than intended, and `speed`
  // would lose its effect on the cursor. The caller interpolates against the real clock: a slow
  // machine gets fewer frames, while the duration and the shape of the path stay correct.
  const movePlan = (from, to, targetSize) => {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 1) return null;

    const moveMs = Math.max(moveDuration(dist, targetSize), pace.cursorFrameMs);

    // A hand does not travel in a straight line: the trajectory bulges out to one side, more
    // visibly the farther it goes, but with a ceiling so it does not turn into a bizarre detour.
    const arc = Math.min(dist * 0.06, 34) * between(0.4, 1) * (rng() < 0.5 ? -1 : 1);
    const nx = -dy / dist;
    const ny = dx / dist;

    // Over a long distance the eye locks onto the target later than the hand: the mouse
    // overshoots the target by a few pixels before correcting back. That correction is the detail
    // a viewer immediately reads as "someone is driving this".
    const overshoot = dist > 260 ? between(5, 13) : 0;
    const aimX = to.x + (dx / dist) * overshoot;
    const aimY = to.y + (dy / dist) * overshoot;

    const settleMs = overshoot ? pace.cursorSettleMs : 0;
    const duration = moveMs + settleMs;
    const split = moveMs / duration;

    // Sub-pixel hand tremor. A fixed table instead of calling rng() inside the position function:
    // the same t must always produce the same spot, otherwise the path shakes according to how
    // many frames the machine manages to run.
    const noise = Array.from({ length: 24 }, () => ({ x: between(-0.4, 0.4), y: between(-0.4, 0.4) }));

    const at = (t) => {
      const clamped = Math.max(0, Math.min(t, 1));
      if (clamped >= 1) return { x: to.x, y: to.y };

      const shake = noise[Math.floor(clamped * (noise.length - 1))];
      if (clamped >= split) {
        // The correction phase: from the overshoot back onto the target, decelerating.
        const local = (clamped - split) / (1 - split);
        const p = 1 - (1 - local) ** 2;
        return { x: aimX + (to.x - aimX) * p, y: aimY + (to.y - aimY) * p };
      }

      const local = clamped / split;
      const p = ballistic(local);
      const bulge = arc * Math.sin(Math.PI * local);
      return {
        x: from.x + (aimX - from.x) * p + nx * bulge + shake.x,
        y: from.y + (aimY - from.y) * p + ny * bulge + shake.y,
      };
    };

    return { duration, frameMs: pace.cursorFrameMs, at };
  };

  // Scrolling has the same shape as a move: a flick that covers most of the ground quickly, then
  // eases off. What differs is where the duration comes from — how many screens of page have to
  // travel, rather than how small the target is. A whole-page jump therefore takes longer than a
  // nudge, but never so long that the viewer is watching the scenery go by.
  const scrollPlan = (dx, dy) => {
    const dist = Math.hypot(dx, dy);
    if (dist < 1) return null;
    const screens = dist / Math.max(1, viewport.height);
    const raw = pace.scrollBaseMs + pace.scrollPerScreenMs * screens;
    const duration = Math.round(Math.min(raw, pace.scrollMaxMs) * (1 + between(-0.12, 0.12)));
    return {
      duration,
      frameMs: pace.scrollFrameMs,
      // How much of the distance has been covered at t — the caller wheels the difference from
      // what it has sent so far, so a slow machine sends fewer, larger deltas over the same time.
      at: (t) => {
        const p = ballistic(Math.max(0, Math.min(t, 1)));
        return { x: dx * p, y: dy * p };
      },
    };
  };

  // Aim first, then click. Sliding to the cell right next door is almost an immediate click,
  // while having just crossed the whole screen costs a beat to re-locate.
  const aimDelay = (dist) => {
    const share = Math.max(0.35, Math.min(dist / 600, 1));
    return wait(pace.beforeClickMs * share);
  };

  // No two characters ever land closer together than this, however hard the budget squeezes: below
  // it the text stops appearing and starts being pasted.
  const MIN_CHAR_MS = 8;

  // People do not type evenly: they slow down on spaces and after punctuation, and now and then
  // hesitate for a beat.
  const charDelay = (char, prev) => {
    let ms = pace.typeCharMs * between(0.65, 1.35);
    if (char === ' ') ms *= 1.4;
    if (prev && '.,;:!?、。」）)'.includes(prev)) ms *= 1.8;
    if (rng() < 0.05) ms *= between(2.2, 3.4);
    return Math.max(MIN_CHAR_MS, Math.round(ms));
  };

  // A per-character rate is right for what people type into a form and wrong for anything long:
  // the rhythm reads as a person at a keyboard, and two hundred characters of it is twenty
  // seconds of a video in which nothing else happens. Past a budget for the whole piece the same
  // delays are scaled to fit it, which keeps the rhythm — the pauses on spaces and after
  // punctuation stay in proportion — and lets a long line arrive at the speed of someone who
  // knows what they are typing.
  const typeDelays = (text) => {
    const delays = Array.from(String(text)).map((char, i, all) => charDelay(char, all[i - 1]));
    const total = delays.reduce((sum, ms) => sum + ms, 0);
    if (!pace.typeMaxMs || total <= pace.typeMaxMs) return delays;
    const ratio = pace.typeMaxMs / total;
    return delays.map((ms) => Math.max(MIN_CHAR_MS, Math.round(ms * ratio)));
  };

  // Until the cursor has appeared in the frame there is no such thing as "where it is standing".
  // Bring it in from a point off the centre so the first move does not look like a jump.
  const restingPoint = () => ({
    x: viewport.width * between(0.42, 0.58),
    y: viewport.height * between(0.5, 0.66),
  });

  return { wait, moveDuration, movePlan, scrollPlan, aimDelay, charDelay, typeDelays, restingPoint, rng };
}

// Not every action has something to look at. Opening a tab, expanding a menu, moving to the next
// field — a real person goes straight through those; they only stop to read once a result appears
// on screen. These three levels let a step script say that instead of scattering ms numbers
// around, and they read the same whether the action was a click or a command in the terminal.
const PAUSE_LEVELS = {
  quick: 'afterClickQuickMs',      // only a step towards the next action, nothing to look at
  normal: 'afterClickMs',
  observe: 'afterClickObserveMs',  // the result on screen has to be read
};

function resolvePause(pause, pace, fallbackMs) {
  if (pause === undefined) return fallbackMs;
  if (typeof pause === 'number') return pause;
  const key = PAUSE_LEVELS[pause];
  if (!key) {
    throw new Error(
      `Invalid pause: ${JSON.stringify(pause)}\n` +
      `Use a number of ms, or one of ${Object.keys(PAUSE_LEVELS).join(' | ')}.`
    );
  }
  return pace[key];
}

module.exports = { createHuman, createRng, hashSeed, ballistic, PAUSE_LEVELS, resolvePause };
