# Screen capture and redaction — build order

Spec: `backlogs/screen-capture/spec.md`.

Redaction lands first even though the screen capture is what motivated it. Redaction works on the
existing page recording, so it can be built and proved headless, with no screen and no permission
prompt; the capture backend then arrives with somewhere safe to put what it records.

The same split as before: the arithmetic and the ffmpeg argument lists are plain functions in
node, so `node --test` covers them without a screen, a browser or a recording.

---

## 1. Redaction arithmetic — `scripts/redaction.js`

- `createRedactions()` collects `{ from, to, mode, box }` against the take's clock.
- `buildFilter(redactions, trimAt)` returns the ffmpeg `-vf` chain for `blur` and `box`:
  `drawbox` for a solid fill, `split`/`crop`/`boxblur`/`overlay` for a blurred region, each gated
  with `enable='between(t,a,b)'`. A whole-frame blur needs no crop.
- `buildCuts(redactions, duration)` returns the segments to keep, and `shiftTime(at)` maps a
  timestamp on the original take to its place in the shortened one.
- A mark or caption inside a cut is dropped, not collapsed onto a zero-length row.

**Done when** the tests cover: each mode's filter, two overlapping regions, a region and a cut in
the same take, a cut at the very start, and the timestamps either side of one.

## 2. `redact()` in a step script — `scripts/record.js`

- `redact(area, body, { mode })` added to the context; `area` is a locator or `'frame'`.
- The box is measured on entering and on leaving, and the union is used. Measured neither time, it
  is an error naming `'frame'` as the alternative — never a silent fallback to recording it plainly.
- `shot()` inside a region window passes the locator to Playwright's own `mask`. Inside a
  `'frame'` window it is refused: an entirely blacked screenshot proves nothing.
- The encode applies the filter chain; a take with cuts rebuilds the runbook's timestamps through
  `shiftTime`, and says in the runbook that stretches were removed.

**Done when** a headless take with a redacted region comes out measurably blurred there and sharp
everywhere else, and the runbook of a take with a cut points at the right seconds.

## 3. The capture backend — `scripts/capture.js`

One interface, two implementations, chosen by `recording.capture`:

```
start() -> { startedAt }      stop() -> { file }
```

- `page` wraps what `record.js` does today: `recordVideo` on the context.
- `window` and `screen` spawn ffmpeg on avfoundation. `cropFor(rect, scale)` turns the window's
  logical rectangle into physical pixels. `readProgress(chunk)` parses `-progress pipe:1` and
  reports the instant the first frame was written, which is the take's t=0.
- Stopping writes `q` to ffmpeg's stdin so the file is finalised rather than truncated.
- Before the take: refuse without `SCREEN_CAPTURE=1`; probe permission by capturing a fraction of
  a second and rejecting a flat frame, naming the setting to open; turn Do Not Disturb on and put
  it back afterwards; show the on-screen notice and count down.

**Done when** the unit tests cover the crop arithmetic at 1x and 2x and off the origin, the
progress parser including a line split across two reads, and the consent refusal; and a real
`window` take on this machine contains the browser's own chrome.

## 4. Configuration — `scripts/settings.js`

`recording.capture` and `recording.screenCapture`, merged and validated like the other scopes,
with a message naming the offending key.

**Done when** `tests/settings.test.js` covers the defaults, an override, and each rejection.

## 5. Documentation

- `SKILL.md`: when to reach for a window capture, and that the agent asks the user before one —
  it holds the only channel to them, and the runner cannot prompt.
- `SKILL.md`: after a `window` or `screen` take, review it once with the `vision` skill and report
  what it finds with timestamps. It is a last look for a person to act on, not an eraser.
- `references/writing-step-scripts.md`: `redact()`, the three modes, and that `cut` moves every
  timestamp after it.
- `assets/evidence.config.example.js`: the `capture` scope.
- The four READMEs are one document: the limits section changes in all four, commands byte-identical.

## 6. End to end — `tests/e2e`

- The existing take keeps running on `page`, headless, in CI.
- A second script records the demo app with `capture: 'window'` and asserts the frame contains
  browser chrome, then that a redacted region is blurred and the same region in the `page` take is
  not. It skips itself, loudly, where there is no screen or no permission — a check that silently
  passes on a machine that cannot run it is worse than no check.
