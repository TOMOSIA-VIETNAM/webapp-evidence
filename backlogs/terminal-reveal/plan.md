# Terminal panel, sized and paced — build order

Spec: `backlogs/terminal-reveal/spec.md`.

Same split the panel already follows: every number is decided in node and unit tested without a
browser; the injected file animates to what it is handed. Each task lands on its own with its
tests and leaves `node --test 'tests/*.test.js'` green.

---

## 1. The geometry, as plain functions — `scripts/terminal.js`

Pure functions, exported, no shell and no page:

- `rowsFor(height, fontSize)` — exists as `visibleRows`, keep it.
- `heightFor(rows, fontSize, { base, ceiling })` — the pixel height that shows `rows` rows,
  clamped between the idle height (title bar + 3 rows) and the ceiling.
- `revealPlan(backlogRows)` — `{ rowsPerSecond, durationMs }`. Speed is
  `backlogRows / 6s`, clamped to 8..20 rows per second; duration follows from it.
- `idleHeight(fontSize)` — title bar + padding + 3 rows.

**Done when** `tests/terminal.test.js` covers: a height below the idle floor is raised to it, one
above the ceiling is capped, an overflow small enough to finish under six seconds uses the floor
speed, a large one uses the ceiling speed and reports a duration above the warning threshold, and
the row count a height produces round-trips back to that height.

## 2. Height and scroll in the panel — `scripts/terminal-panel.js`

`sync()` takes two more fields, and keeps being the only entry point:

- `height` — animated, 220ms growing and 320ms shrinking, by setting the transition duration for
  the direction before the height. The existing `transform` transition for open and close is
  untouched and must not be replaced by this one.
- `scrollRow` and `scrollMs` — the index of the first row to show, and how long to take getting
  there. Rows are drawn into a wrapper inside the body; the wrapper is moved with
  `transform: translateY()` under the Web Animations API, `linear`, filling forwards. `scrollMs: 0`
  jumps.

The body keeps `overflow: hidden`, so nothing the runner has not scrolled to is on screen.

Background alpha becomes a value `sync()` carries rather than a constant in the stylesheet, with a
`backdrop-filter: blur(6px)` behind it.

`coveredFrom()` measures the panel's real height with `getBoundingClientRect()` instead of reading
the state it is animating towards.

**Done when** the recorded demo take shows the panel growing for a long output and shrinking for a
short one, the text behind it is legible through it, and a click on an element the panel covers is
still refused mid-animation.

## 3. Driving the window — `scripts/terminal.js`

The runner keeps the whole screen and decides which part of it is on the panel:

- A cursor for the bottom row currently shown. It advances towards the last row of the buffer at
  the speed `revealPlan` gives, recomputed each redraw tick as the backlog changes.
- The redraw timer keeps running after a command exits until the cursor reaches the bottom, then
  stops. `run()` does not resolve before that.
- Height target is the rows this command has produced, clamped by `heightFor`. It only grows while
  a command is running. The move to the next command's target happens when that command's first
  output arrives.
- A 500ms settle after new content is first drawn, before the scroll starts. Multiplied by the
  take's speed like every other pause.
- Lines sent per paint are capped (1200) so a huge scrollback does not go over the wire every tick.
  The cap is above anything the warning threshold allows, so it never cuts into what is being
  revealed.
- When a command's scroll runs longer than 10 seconds, one line on stdout naming the command and
  the duration, in the same shape as the runner's other `FIXED:` lines.

`panelHeight` becomes a function, and `record.js` calls it. That is the only call site.

**Done when** `tests/terminal.test.js` drives a real `bash` printing more rows than fit and shows:
every row reached the payload sent to the page, the bottom row advanced monotonically, the panel
never sent a row index it had not reached, and the warning fires for an output long enough to
deserve it.

## 4. Config — `scripts/settings.js`

- `recording.terminal.height` keeps its name, its default and its validation, and its comment says
  it is the ceiling.
- `recording.terminal.opacity`, default 0.86, validated to 0.5..1. Below 0.5 the text stops being
  readable over a light page.
- The pacing numbers from the spec live beside the existing pace keys, so a project can slow the
  reveal down the way it can slow a click.

**Done when** `tests/settings.test.js` covers the new key's default, an override, and the two ends
of its range.

## 5. The demo take proves it — `tests/e2e/`

The existing e2e app gains a page that prints a long block on demand, and `demo-steps.js` runs one
short command and one long one.

**Done when** `./tests/e2e/run.sh` passes, and the `vision` skill's contact sheet of the take shows
the growth, the scroll and the shrink as separate frames.

## 6. Documentation

`references/terminal-in-the-page.md` gains a short section: the panel sizes itself, the reveal is
paced, and a command whose output is too long to scroll should be cut down with `jq` or `head`
rather than recorded whole.

**Done when** the four READMEs still agree and `tests/platform-layer.test.js` passes.
