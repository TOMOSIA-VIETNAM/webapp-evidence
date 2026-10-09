# Editing a take after it has been watched

## The gap this closes

`redact()` asks whoever writes the step script to decide, before anything is recorded, what on the
screen is sensitive. That decision is made blind and is sometimes wrong, and what it produces — a
blurred rectangle in the middle of a working page — reads as a rendering fault in the one video
meant to show the page working. What is sensitive is the user's call, and they can only make it
after watching the take.

The other requests that arrive after watching are of the same kind: "faster", "point at the Save
button", "drop the part where it waits". Today every one of them means recording again. None of
them needs to: the video, the screenshots and the step timeline already hold everything required.

So the in-take API goes, and a command that edits the finished files takes its place.

## Who uses it

The agent, on the user's request after a take. The user never runs it directly; they say what they
want changed, and the agent turns that into `edit.js` calls.

## What it is

`scripts/edit.js` applies edits to a finished take. Every edit is rendered from the untouched
recording, so quality loss is one encode no matter how many rounds of edits there are.

```
node scripts/edit.js <OUT_DIR>/<name>.mp4 <operation> [target] [options]
node scripts/edit.js <OUT_DIR>/NN-<shot>.png <operation> [target]
node scripts/edit.js --help
```

### Operations

| operation | on | what it does |
|---|---|---|
| `speed <factor>` | video | whole take, or `--at/--to` range only |
| `cover` | video, screenshot | pixelates a box for a time range |
| `highlight` | video, screenshot | rounded rectangle around a box |
| `arrow` | video, screenshot | straight arrow pointing at a box |
| `cut` | video | removes a time range |
| `trim` | video | removes from the start and/or the end |
| `still <seconds>` | video | extracts a screenshot at that moment of the edited video |
| `list` | both | prints the edits applied so far, numbered |
| `undo [n]` | both | drops the last edit, or edit `n` |
| `reset` | both | drops every edit and the edited outputs |

### Targets

- `--step "<mark label>"` — the box of the element that step acted on, and the time from that mark
  to the next one. An unknown label fails and prints the labels that exist.
- `--at <s> --to <s>` — a time range on the **edited** video, the one the user watched.
- `--box x,y,w,h` — frame pixels, for something no step touched.

`--step` is the expected path: the user names a step or an element, and nobody has to estimate
coordinates. The other two are the fallback when a step does not cover it.

### Files

| file | written by | contents |
|---|---|---|
| `<name>.mp4`, `NN-*.png`, `<name>-runbook.md` | `record.js` | as today; never modified by `edit.js` |
| `<name>-timeline.json` | `record.js` | frame size, duration, removed stretches, and per mark `{ at, label, box }`; per screenshot `{ file, box }` |
| `<name>-edits.json` | `edit.js` | the ordered list of edits; each run re-applies the whole list |
| `<name>-edited.mp4`, `NN-*-edited.png` | `edit.js` | the result |
| `<name>-edited-runbook.md` | `edit.js` | the runbook with every timestamp moved to match the edited video, and a section listing the edits applied |

`box` in the timeline is in **video-frame** coordinates. For a window or screen take that is not the
page's coordinate system; the conversion already done for redaction in `capture.js` is reused.

## Style

Fixed in one module, `scripts/style.js`, with no configuration: the point is that every take looks
the same.

| element | style |
|---|---|
| accent colour | `#C66A42` — the orange the runner already draws the cursor, its click ring and the terminal caret in, so everything the recording adds is one colour |
| stroke | 4px, with a white halo 2px each side (an 8px white stroke drawn under it), so it reads on dark and light pages |
| highlight | rounded rectangle, radius 8px, padded 6px outside the target box |
| arrow | always drawn with the highlight of the same box; straight line, round cap, solid triangular head; tip stops 4px outside that highlight's ring |
| cover | pixelate (mosaic) — each block the average colour of what it hides, blocks large enough that the text cannot be read back |
| scale | every size above is for a 1280px-wide frame and scales with the frame width |

Highlights and arrows on video and on screenshots come from the **same** SVG, rendered by
Playwright: over the PNG for a screenshot, to a transparent PNG laid over the video with ffmpeg
`overlay` for a time range. One drawing path, so the two cannot drift.

### The box a mark goes round

A step's box is the element it acted on **over the whole step**, not only at the moment of the
action: the runner measures the element when it acts on it and again when the step ends (the next
`mark()`, or the end of the take for the last one), and stores the union of the two, in frame
pixels. A button whose label grows once clicked ("Run sync" becoming "Sync queued") is then inside
its highlight after the click too. The second measurement goes through the element itself, not the
locator, which often names the element by the label that changed. Kept at the action-time box: an
element that has left the page, and one that no longer overlaps where it was (scrolled or pushed
away — a box over both places would point at neither).

### Where the arrow comes from

There are 16 candidate arrows: 8 directions (right, left, below, above, then the four diagonals,
right-hand ones first) at 2 lengths — the full `arrowLength` (120px) and `shortArrowLength` (72px,
60% of it, same head), for a dense layout where the only calm strip is the gap next to the element.
Of the candidates that fit entirely inside the frame, the one whose strip covers the least detail
wins, measured on the picture the arrow will be drawn on (the frame the mark starts on, or the
screenshot): busyness is the mean brightness step between neighbouring pixels within the head's
half-width of the shaft. Candidates within 2 levels of the calmest count as equally calm, and the
first of those in the order above is drawn — so a plain page gets the full-length arrow from the
right, and the short one only appears where every full-length strip is clearly busier. Without a
picture, the first candidate that fits is drawn.

When even the calmest candidate's strip crosses text or another control, no arrow is drawn: the
mark falls back to the highlight alone, and `edit.js` says so in one line. The highlight already
says where to look; a shaft through a neighbouring label makes the frame look broken. "Crosses"
is a fixed busyness ceiling in `style.js`, measured on the strip's busiest stretch rather than its
mean, so a long arrow that clips one word and then runs over white space is not averaged clean.

### Marks appear by being drawn

In the video a highlight or an arrow does not pop in finished: a mark that is simply there is
missed by a viewer whose eye was elsewhere, and the cut-in reads as a glitch. It draws itself
instead, fast enough not to hold anything up and slow enough to pull the eye to the spot:

| mark | how it appears | length |
|---|---|---|
| highlight | the outline traces itself round the box, halo and accent together | 0.35s |
| arrow | its highlight traces first, then the shaft grows from the tail toward the box and the head lands at the end | 0.35s + 0.25s |

Then the mark stays, still, until the end of its range, and goes in one frame. The drawing is
`svgFor({ ..., progress })` with `progress` from 0 to 1 (stroke-dasharray on the outline, the
shaft's length for the arrow), rendered once per video frame of the drawing and overlaid as an
image sequence. A screenshot has no time, so it always gets `progress` 1.

The drawing plays inside the range the user asked for, never before it. A range shorter than the
drawing plus one second is lengthened to that, so a mark is always on screen fully drawn for at
least a second; the edits list records the range actually used. Lengths are constants in
`style.js`.

## Transition at a cut

A stretch removed from the middle of a take leaves two pieces of video joined end to end. Today the
join is a hard jump — the page changes with no click to explain it, and the viewer thinks they
missed something. Both producers of such a join get the same treatment: the runner's own cut of the
file picker opening on the wrong folder, and `edit.js cut`.

The transition plays on **held frames**, never on moving ones. If it were drawn over the last
moments before the join, it would blur a click or a page change the viewer has not finished
reading. So at every join:

| phase | frames | length |
|---|---|---|
| hold A | last frame before the join, repeated | 0.4s |
| fade out | that same frame, blurring and darkening toward ~40% brightness | 0.3s |
| fade in | first frame after the join, repeated, clearing from the same state | 0.3s |
| hold B | that frame, repeated, sharp | 0.4s |

Then the video plays on. "Darkens" stops at ~40% brightness, not black — the frame stays
recognisable. All four lengths are constants in `style.js`.

Each join therefore adds 1.4s to the video. That time is inserted, not drawn over, so the runbook
remaps every timestamp after a join through the same function that remaps cuts and speed changes —
an inserted stretch is the opposite of a removed one.

The start-of-take trim (the page-load wait) gets no transition: there is no scene before it.

The dissolve frames show neither scene, so the `vision` contact sheet skips them. The runner writes
where they are, in seconds of the finished video, as `fades` in `<name>-timeline.json`; the sheet
drops those frames before sampling, so a tile that would land there shows the held frame before
the join and every sheet still covers the span it says it does. `edit.js` writes the same field for
the edited video.

## Removing `redact()`

Removed: `redact()` and its helpers in `record.js`, the two `shot()` refusals that only existed for
it, `references/redaction.md`, its mentions in `SKILL.md`, `references/*.md`,
`assets/steps.example.js`, `tests/e2e/steps.js`, `tests/e2e/run.sh`, and the runbook section listing
what was covered.

Kept: `redaction.js` — the runner still cuts the file-picker stretch, and `edit.js` builds its cuts,
covers and timestamp remapping on the same functions. Renamed if its name no longer describes it.
`recording.terminal.scrub` stays: it replaces text before the terminal panel draws it, which is a
different mechanism with no false positives on the page.

A step script that still calls `redact()` fails with a message that it was removed and that
covering something is now done after the take with `edit.js cover`.

## SKILL.md

- One short paragraph: a finished take can be edited without recording again — run
  `node scripts/edit.js --help` for what it can do. The operations are **not** listed in SKILL.md;
  `--help` is the single source, so adding an operation is a change to the script only.
- The recorded take is the default deliverable and stays clean. The agent never applies an edit
  the user has not agreed to: guessing what matters is the same mistake `redact()` made.
- In the final report, after the paths: the agent runs `edit.js --help` and offers at most two
  edits tied to what the take is meant to prove — the step that shows the change, a long wait
  worth speeding up — each one sentence the user can answer yes to. One more line: other edits are
  possible without recording again, and changing what is on screen (other data, other steps)
  means re-running the step script, whose command the runbook holds. This is how a user who does
  not know the command exists still gets the edit that helps.
- On yes, the agent runs `edit.js` and reports the `*-edited.*` paths and that the recording is
  unchanged. The edited runbook lists what was added, so a reviewer reads the marks as notes, not
  as the application's UI.
- Sensitive data: recorded as it was on screen; the user decides afterwards. The clean fix,
  recommended when the user raises it, is fake data in the step script.

## Commands

```bash
npm install --prefix src/skills/recording/scripts --no-audit --no-fund   # first time
node --test 'tests/*.test.js'     # unit tests, no browser
./tests/e2e/run.sh                # records the demo app in real Chrome, then edits the take
```

## Code style

Follows the scripts already there: CommonJS, no new dependency (Playwright and ffmpeg are already
required), plain functions that build ffmpeg argument strings so they are testable without a video,
comments that say why. `redaction.js` is the model:

```js
// Where a moment of the original take ends up once stretches have been removed. Returns null for
// a moment inside one: the runbook drops that row rather than pointing at a second the viewer
// will find something else at.
function shiftTime(at, removed) { … }
```

## Tests

Unit (`tests/*.test.js`, no browser, no video):

- timeline json and runbook timeline built from the same marks agree
- speed remaps timestamps, whole take and range
- cut + speed combined remap correctly, in either order of application
- `--step` resolves to the right box and time range; an unknown label lists the known ones
- the edits list: append, `undo`, `undo n`, `reset`
- the filter graph for a cut contains the transition at each join and none at the start trim
- style sizes scale with frame width
- a step script calling `redact()` fails with the replacement named

End to end (`tests/e2e/run.sh`): after recording, apply one edit of each kind; check the outputs
exist, the original files are byte-identical to before, the edited duration matches the speed
factor and the cut, the edited runbook's timestamps moved, and a pixel inside a highlight on the
edited screenshot is the accent colour.

Assertions target behaviour, not message wording.

## Boundaries

- **Always:** render from the original; keep `--help` the only list of operations; run the unit
  suite and `run.sh` before calling a task done.
- **Ask first:** any new dependency; making the style configurable; changing what `record.js`
  writes beyond adding `<name>-timeline.json`.
- **Never:** overwrite or modify the recorded mp4, screenshots or runbook; list the operations in
  SKILL.md; decide on its own that something is sensitive and cover it.

## Success criteria

1. The user asks for "2× faster, cover the email in step 3, highlight Save in the last screenshot";
   the agent does it with three `edit.js` calls and no re-recording, in under a minute of wall time
   for a take under two minutes.
2. `grep -rn redact src/skills tests` finds nothing but the removal error and `redaction.js` (or its
   new name).
3. A take with the file-picker cut shows, at the join, a held frame, the blur-and-darken
   transition, and a held frame again — no motion while the effect plays — and every runbook
   timestamp after the join is 1.4s later than the same take before this change.
4. Adding an operation to `edit.js` requires no change to SKILL.md for the agent to offer it.
5. Unit suite and `run.sh` green.

## Decided

- **A navigation inside the take** (`page.goto` with no click before it) gets no transition. The
  viewer saw the steps leading to it; a transition is only for footage that was taken out.
- **`--at/--to` are read against the edited video** — what the user watched. Once resolved, each
  edit is stored in original-video time, so `undo` of an earlier speed edit does not shift a later
  cover off its target.
