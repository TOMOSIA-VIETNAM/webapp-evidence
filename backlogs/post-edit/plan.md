# Editing a take after it has been watched — build order

Spec: `backlogs/post-edit/spec.md`.

The split that keeps this testable is the one `redaction.js` already follows: **every decision is
a plain function** — time remapping, edit resolution, filter-graph strings, SVG markup — and the
code that touches ffmpeg, Playwright or the disk only runs what those functions return.
`node --test` drives the functions without a video or a browser.

Each task lands on its own, with its tests, and leaves `node --test 'tests/*.test.js'` green.

## Order

```
1 runbook data ──┬──> 4 edit model ──> 5 video render ──> 7 edited runbook ──> 9 SKILL.md ──> 10 e2e
                 │                 └─> 6 screenshot render ┘                      ^
2 transition ────┘ (5 reuses it)                                                  |
3 style + overlay ──> 5, 6                                         8 remove redact() ┘
```

1, 2 and 3 are independent. 8 can land any time after 2 (the transition must not be lost with the
code that is removed around it).

## Checkpoints

- **After 2**: `./tests/e2e/run-native.sh` (the only take with the file-picker cut — it opens the
  real picker, so it needs a screen and Accessibility permission), then look at the join through
  the `vision` skill. The transition is the one part whose correctness is visual. After 5, an
  `edit.js cut` on the headless take shows the same join without a screen.
- **After 6**: render the highlight and arrow on a real screenshot and on a frame of the video, and
  compare them to the chosen style board side by side.
- **After 10**: the success criteria in the spec, one by one.

## Risks

| risk | mitigation |
|---|---|
| ffmpeg has no time-varying blur radius, so "blur gradually" cannot be one filter. Working on held frames helps: the blurred copy of one still frame is computed once | blend a blurred copy over the sharp one with an alpha `fade`; same trick for the darkening, with a black source capped at 60% opacity. Spike it first inside task 2 before writing the graph builder |
| A range-only speed change needs the take split into pieces, each with its own `setpts`, then joined | the same split/trim/concat `buildFilter` already does for cuts; generalise it rather than add a second one |
| Boxes recorded in page coordinates are wrong for a window or screen take | record them through the same page→frame conversion the redaction code uses in `capture.js`, and assert it in `run-window.sh` |
| Removing `redact()` loses the runner's own picker cut by accident | task 2 adds a test that the picker cut still produces a cut with a transition; task 8 must keep it green |

---

## Tasks

### 1. Runbook data — `<name>-timeline.json`

- [ ] `record.js` writes `<name>-timeline.json` holding everything the runbook is built from: frame
  size, duration, trim point, removed stretches, and every timed entry (marks, hotkeys, notes,
  commands, dialogs, captions) with its time in **original-take** seconds.
- [ ] Each mark carries `box`: the frame-coordinate bounding box of the element that step acted on,
  or null. Each screenshot entry carries the box of the element it was taken around, or null.
- [ ] The runbook is rendered from that data through one function, so `edit.js` can call the same
  function with a remap and the two runbooks cannot disagree in layout.
- Acceptance: a unit test builds the data from a set of marks, renders the runbook from it, and the
  timeline section is identical to what `record.js` produces today for the same input.
- Verify: `node --test 'tests/*.test.js'`; `./tests/e2e/run.sh` writes the json beside the runbook.
- Files: `scripts/record.js`, `tests/record.test.js`

### 2. Transition at a cut — `redaction.js`

- [ ] Every join between two kept segments: hold the last frame of A (0.4s), blur and darken it
  toward ~40% brightness (0.3s), cut to the first frame of B in that same state and clear it
  (0.3s), hold it sharp (0.4s), then play on. Nothing moves while the effect plays: the effect is
  on repeated frames (`tpad` clone), never on frames that show an action.
- [ ] The inserted 1.4s per join is returned with the graph, as `removed` already is, so every
  section of the runbook moves the timestamps after a join through one remap function.
- [ ] No transition at the start-of-take trim.
- Acceptance: unit tests on the graph string — one transition per join, none at the trim, output
  duration = kept duration + 1.4s × joins; runbook times after a join shifted by 1.4s, before it
  untouched; the runner's file-picker cut still produces a cut.
- Verify: `node --test`; `./tests/e2e/run-native.sh`, then look at the join with
  `node src/skills/vision/scripts/contact-sheet.js`.
- Files: `scripts/redaction.js`, `scripts/record.js` (runbook remap), `tests/redaction.test.js`

### 3. Style and overlay — `scripts/style.js`, `scripts/overlay.js`

- [ ] `style.js`: the fixed values from the spec and a `scaled(frameWidth)` that returns the sizes
  for that frame.
- [ ] `overlay.js`: `svgFor({ kind: 'highlight' | 'arrow', box, frame })` returns SVG markup; a
  Playwright helper renders that SVG either over a PNG or to a transparent PNG of the frame size.
- [ ] The arrow picks the side with room: from the right of the box if there is space, else the
  left, else below — tip 4px outside the box.
- Acceptance: unit tests on the markup (colour, stroke widths at 1280 and 1920, padding, arrow
  side selection at a frame edge).
- Verify: `node --test`; render one of each over a PNG and look at it.
- Files: `scripts/style.js`, `scripts/overlay.js`, `tests/overlay.test.js`

### 4. Edit model — `scripts/edits.js`

- [ ] Load and save `<name>-edits.json`; append, `undo`, `undo n`, `reset`.
- [ ] Resolve a target to original-take time and frame box: `--step` from the runbook data,
  `--at/--to` read against the edited video and mapped back through the edits before it,
  `--box` as given. Unknown step: fail listing the known labels.
- [ ] Map any original-take time to edited-video time through the whole edit list (trim, cut,
  speed), returning null for a moment that was removed. Reuse `shiftTime`/`mergeRanges`.
- Acceptance: unit tests for each of those, including cut + speed in either order and `undo` of a
  speed edit leaving a later cover on its target.
- Verify: `node --test`
- Files: `scripts/edits.js`, `scripts/redaction.js` (export what is reused), `tests/edits.test.js`

### 5. Video render — `scripts/edit.js`

- [ ] Highlight and arrow draw themselves in the video (`svgFor` with `progress`, one PNG per
  frame of the drawing, overlaid as an image sequence starting at the range's start), then hold
  still; a range too short for the drawing plus one second is lengthened. Screenshots get the
  finished mark.
- [ ] `<name>-edited-timeline.json` carries `fades` for the edited video, so the contact sheet skips
  its dissolves too.
- [ ] CLI: `edit.js <video> <operation> [target] [options]`, `--help` lists every operation and
  target with one line each. Each run appends the edit, then renders the whole list from
  `<name>.mp4` into `<name>-edited.mp4`.
- [ ] Graph: pixelate covers, overlays for highlight/arrow (from task 3), then trim, cuts with the
  transition from task 2, then speed (whole or per range).
- [ ] `still <s>`: extracts a frame of the edited video as the next numbered screenshot.
- Acceptance: unit tests on the graph built from an edit list, on `svgFor` at progress 0, 0.5 and
  1 (dash offset, shaft length, head only at the end), and on the lengthening of a short range;
  the original is never opened for
  writing.
- Verify: `node --test`; run each operation on the e2e take by hand.
- Files: `scripts/edit.js`, `scripts/redaction.js`, `tests/edit.test.js`

### 6. Screenshot render

- [ ] `edit.js <NN-shot.png> cover|highlight|arrow [target]` writes `NN-shot-edited.png`, applying
  the screenshot's whole edit list from the original. `--step` on a screenshot uses its recorded box.
- Acceptance: unit test that the screenshot edit list is kept separately from the video's.
- Verify: render one of each; the checkpoint after this task.
- Files: `scripts/edit.js`, `tests/edit.test.js`

### 7. Edited runbook

- [ ] `<name>-edited-runbook.md`: rendered by the task 1 function with every time mapped through
  task 4; rows that fell inside a cut are dropped, as today; a section lists the edits applied,
  in words, with their edited-video times.
- Acceptance: unit test — a 2× speed edit halves every timestamp; a cut drops the rows inside it.
- Verify: `node --test`
- Files: `scripts/edit.js`, `scripts/record.js`, `tests/edit.test.js`

### 8. Remove `redact()`

- [ ] Remove `redact()` and its helpers, the `shot()` refusals that only existed for it, the
  runbook section listing covered regions, `references/redaction.md`, and every mention in
  `SKILL.md`, `references/*.md`, `assets/steps.example.js`, `tests/e2e/steps.js`, `tests/e2e/run.sh`.
- [ ] `redact` stays in the helpers passed to the step script only as a function that throws:
  removed, use `edit.js cover` after the take.
- [ ] Rename `redaction.js` if what is left no longer reads as redaction (it is cutting, covering
  and remapping time); update its requires.
- Acceptance: `grep -rn redact src/skills tests` finds only the removal error and the renamed
  module's history-free name.
- Verify: `node --test`; `./tests/e2e/run.sh`
- Files: `scripts/record.js`, `scripts/redaction.js`, `references/*.md`, `assets/steps.example.js`,
  `tests/e2e/*`, `tests/redaction.test.js` — more than five, because a removal has to be whole

### 9. SKILL.md

- [ ] One paragraph: a finished take can be edited without recording again; run
  `node scripts/edit.js --help`. No list of operations.
- [ ] The recorded take is the default deliverable and stays clean: the agent never applies an
  edit the user has not agreed to.
- [ ] Final report: run `edit.js --help`, then offer at most two edits tied to what the take is
  meant to prove (the step that shows the change, a long wait worth speeding up), each as one
  sentence the user can answer yes to. One more line: other edits are possible without recording
  again; changing what is on screen means re-running the step script.
- [ ] On yes, run `edit.js`; report the `*-edited.*` paths and that the recording itself is
  unchanged. The edited runbook lists what was added, so a reviewer reads the marks as notes, not
  as the application's UI.
- [ ] Sensitive data: shown as recorded, the user decides afterwards; fake data in the step script
  is the clean fix. Add `references/editing-a-take.md` only if `--help` cannot carry something the
  agent needs (how to turn "the email in step 3" into a `--step`).
- Acceptance: SKILL.md names no operation of `edit.js`.
- Files: `src/skills/recording/SKILL.md`, maybe `references/editing-a-take.md`

### 10. End to end

- [ ] `tests/e2e/run.sh`, after the take: one edit of each kind; the originals byte-identical to
  before; edited duration matches speed and cut; edited runbook timestamps moved; a pixel inside a
  highlight on the edited screenshot is the accent colour; the join left by `edit.js cut` is darker
  than the frames either side of it.
- Verify: `./tests/e2e/run.sh`; `./tests/e2e/run-window.sh` once for the frame-coordinate boxes.
- Files: `tests/e2e/run.sh`, `tests/e2e/steps.js`
