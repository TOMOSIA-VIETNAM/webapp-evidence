# Terminal panel — build order

Spec: `backlogs/terminal-panel/spec.md`.

The split that makes this testable: **every stateful decision lives in node**, and the file
injected into the page only draws what it is handed. The stream parser, the line buffer, the
prompt-marker protocol and the scrubber are all plain functions or plain objects that
`node --test` can drive without a browser, which is the rule the rest of the suite already
follows.

Each task below lands on its own, with its tests, and leaves the suite green.

---

## 1. Stream model — `scripts/ansi.js`

Turns a raw pty byte stream into a line buffer the page can draw.

- `createScreen({ maxLines })` → `write(chunk)`, `lines()` where a line is
  `[{ text, fg, bold, dim }]`.
- Handles `\n`, `\r` (overwrite from column 0), backspace, SGR (0, 1, 2, 30–37, 90–97, 39),
  erase-line (`\x1b[K`, `\x1b[2K`).
- Drops other CSI and OSC sequences without emitting their bytes as text.
- Throws a named error on `\x1b[?1049h` telling the caller the program needs a full terminal
  emulator and this panel is line-oriented.
- Chunk boundaries must not corrupt anything: an escape sequence split across two `write` calls
  parses the same as one call.

**Done when** the unit test covers each of those, including the split-chunk case, and a colour
run that spans a `\r` overwrite.

## 2. Scrubbing — `scripts/scrub.js`

- `createScrub({ secrets, patterns })` → `(text) => text` replacing each hit with `••••••`.
- `secrets` are literal strings (the account password); `patterns` are RegExp from the config.
- Rejects a pattern that would match the empty string, which would otherwise shred the output.

**Done when** the test shows the same function scrubs panel text and runbook text, and that a
literal secret containing regex metacharacters is escaped rather than compiled.

## 3. The shell session — `scripts/shell.js`

No knowledge of the page or of the screen model. Owns the child process and the sentinel
protocol.

- `createShell({ command, args, cwd, env, onOutput })` spawns the shell on pipes and opens the
  session with `exec 2>&1` so stdout and stderr arrive interleaved in the order written.
- Each command is followed by a sentinel that frames the exit code in zero-width spaces. The
  frame is stripped from what reaches `onOutput`; the code is delivered as an event. A frame
  split across two reads is reassembled.
- `run(cmd)` resolves `{ exitCode, output }`; `start(cmd)` backgrounds the command and resolves
  `{ pid }` from `$!`; `waitFor(pattern, { timeout })` resolves on a match in the accumulated
  output; `interrupt(pid)` sends `kill -INT`; `close()` ends the session.
- Every wait has a timeout whose error carries the last lines seen, and an unexpected exit of
  the shell rejects whatever is waiting rather than hanging until the timeout.

**Done when** the test drives a real `bash`: a command that succeeds, one that fails with the
exit code reported, state carried between commands (`cd`, a variable), stderr appearing in the
right place, a `waitFor` that matches, a `waitFor` that times out with output in the message, a
backgrounded command interrupted by pid, and a sentinel arriving in two pieces.

## 4. The panel — `scripts/terminal.js` and its glue

- `scripts/terminal.js` is an init script like `cursor.js` and `caption.js`: attaches to
  `documentElement`, `pointer-events: none`, keeps its state on `window` so the
  MutationObserver re-attach after a body swap does not lose scrollback.
  Exposes `window.__evTerm = { open, draw, close }`. It contains no parsing — `draw` takes the
  line array from `ansi.js`.
- The glue in `record.js` wires pty → scrub → screen → throttled `page.evaluate(draw)` at about
  60ms, and types commands through `human.typeDelays` so the rhythm matches the rest of the take.

**Done when** the e2e take shows a command being typed and its output appearing live.

## 5. Configuration — `scripts/settings.js`

- `recording.terminal` defaults per the spec, merged the way the other scopes are.
- Validation with a message that names the offending key, matching the style of the existing
  locale and speed validators.

**Done when** `tests/settings.test.js` covers the defaults, a project override, and each
rejection.

## 6. Wiring into a take — `scripts/record.js`

- `term` added to the context object handed to `run()`.
- `click()` throws when the target's box overlaps an open panel, naming the panel as the reason
  and pointing at `term.close()`.
- Commands and `waitFor` matches are collected with timestamps, and
  `buildCommandSection(commands, trimAt)` renders the runbook section — a pure function, tested
  like `buildHotkeySection` next to it.
- The shell is closed on the failure path too, so a broken step script does not leave a process
  behind.

**Done when** `tests/record.test.js` covers the section builder, and a take that never opens the
panel produces a runbook byte-identical to today's.

## 7. Documentation

- `src/skills/recording/SKILL.md`: the `term` helpers, and the line-oriented limitation stated
  where someone would otherwise try `vim`.
- `assets/steps.example.js`: the trigger-then-verify shape, since that is the case this exists
  for.
- `assets/evidence.config.example.js`: the `terminal` scope with `scrub`.
- `references/writing-step-scripts.md`: when to reach for `run` versus `start` plus
  `waitFor`/`interrupt`.
- The four READMEs are one document — if the feature list changes, all four change, commands and
  paths byte-identical.

**Done when** `tests/platform-layer.test.js` passes and the four READMEs still agree.

## 8. End to end — `tests/e2e`

- The demo app gets an endpoint that writes a line to a log file, so a take can click a button
  and then prove the line arrived.
- `tests/e2e/steps.js` records that: click, `term.open`, `term.start('tail -f …')`,
  `term.waitFor`, `shot`, `term.interrupt`, `term.close`.
- `run.sh` asserts the runbook has the command section and that the screenshot is not blank.

**Done when** `./tests/e2e/run.sh` passes in real Chrome, and the same take passes headless.
