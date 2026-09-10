# Writing a step script

Read this when writing or editing `steps.js`. Full template: `assets/steps.example.js`.

The module returns `{ app, name, start, run(ctx) }`. Inside `run`, use the helpers on `ctx`:

| Helper | What it does |
|---|---|
| `mark('purpose')` | Marks a span in the timeline. Name it by **purpose** — one group of actions — not one per click |
| `click(locator, { pause })` | Moves the cursor to the element with momentum, then clicks (with a ripple effect). `pause` is the wait afterwards: `'quick'` / `'normal'` / `'observe'` or a number of ms |
| `type(locator, text)` | Clicks into the field, then types character by character |
| `select(locator, 'label')` | Opens a `<select>` inside the page and picks the option |
| `upload(locator, path)` | Loads a file into a file input, then pauses so the filename becomes visible |
| `hotkey('ControlOrMeta+C', { label, target })` | Presses a shortcut and shows a key hint overlay in the video |
| `note('a sentence')` | Shows one caption along the bottom of the video, the way a film shows a subtitle |
| `shot('name')` | Takes a screenshot, numbered in capture order |
| `page`, `sleep(ms)` | The locator and wait primitives, for anything the helpers do not cover |

## Every action goes through a helper

Calling Playwright's API directly (`locator.click()`, `locator.fill()`, `locator.setInputFiles()`)
still works and the run still goes green, but the cursor never travels there — the viewer sees a
value appear in a field with nobody pressing anything. This is the most common mistake in a step
script, and it only shows up when someone watches the video back.

| Do not write | Write |
|---|---|
| `locator.click()` | `click(locator)` |
| `locator.fill(text)` | `type(locator, text)` |
| `locator.selectOption(...)` | `select(locator, 'label')` |
| `locator.setInputFiles(path)` | `upload(locator, path)` |
| `page.keyboard.press('Meta+C')` | `hotkey('ControlOrMeta+C', { label: 'コピー' })` |

The helpers' default pacing is already tuned for a viewer to keep up. When it needs adjusting: hold a
modal or dialog for at least 4s before closing it. Write `mark()` in the language the MR reviewer
reads.

## How long to pause after each click

Not every click has something to look at. A real person clicks straight through the steps that only
navigate, and stops when a result appears to be read. Say that with the `pause` level instead of
scattering millisecond values:

| `pause` | Use when | Default |
|---|---|---|
| `'quick'` | The click only moves things along: opening a tab, expanding a menu, putting the cursor in a field before typing | `pace.afterClickQuickMs` (220ms) |
| omitted | An ordinary action; the screen changes but nothing needs close reading | `pace.afterClickMs` (800ms) |
| `'observe'` | The result has to be readable: a submit that renders a list, a modal opening, a validation error | `pace.afterClickObserveMs` (1700ms) |
| a number of ms | A one-off case, such as waiting out one widget's long animation | — |

```js
mark('Filter by status, then search');
await click(page.getByRole('tab', { name: '検索条件' }), { pause: 'quick' });
await select(page.locator('#q_status_eq'), 'Active');
await click(page.getByRole('button', { name: '検索' }), { pause: 'observe' });
await shot('result');
```

A `shot()` almost always goes with `'observe'`: if it is worth capturing, the viewer needs time to
look at it too.

## Captions in the video

`select()` and `upload()` caption themselves — their dropdown and dialog are drawn by the operating
system and cannot be recorded — so the step script does nothing for those. The wording lives in
`scripts/captions.js`, in one place.

`note()` is the one you write yourself, for the things only the script's author knows need saying:

```js
await note('この行はシードデータで、この操作で作られたものではありません。');
```

| Use `note()` for | Example |
|---|---|
| Data that was already there and was not created by this flow | "this record comes from the seed, it is not the result of the action just performed" |
| An error or state that is **expected** | "the server returns 422 because this is the invalid-input screen being recorded" |
| An action hidden by the operating system that no helper knows about | The browser's `confirm()` was just accepted |

Captions are governed by one switch: running with `CAPTIONS=off` hides both the automatic captions
and `note()`, with no exceptions. One switch, one predictable outcome.

A caption sits along the bottom of the frame, centred, where a viewer already looks for words over a
moving picture. It is narration, so it is not anchored to anything: nothing in the middle of the
page gets covered by it, including the result you are trying to prove.

Do not use `note()` to narrate what is already plainly visible. Every caption is a line the viewer
has to read instead of watching — it earns that only by saying something the recording cannot say
for itself.

## Keyboard actions

A shortcut (`Cmd/Ctrl + C/V/X`, `Escape`, `Enter`…) leaves no trace on screen: the mouse sits still,
there is no ripple, and the viewer sees content change for no visible reason. So every key press goes
through `hotkey()` — it shows a key hint overlay next to the element being acted on, holds it long
enough to read both the keys and the result, then hides it.

```js
mark('Copy the user code, then paste it into the search box');
await hotkey('ControlOrMeta+C', { label: 'コピー', target: page.locator('#user_code') });
await hotkey('ControlOrMeta+V', { label: '貼り付け', target: page.locator('#q_keyword') });
```

| Parameter | Meaning |
|---|---|
| `keys` | A Playwright key string: `'ControlOrMeta+C'`, `'Shift+Tab'`, `'Escape'`. Use `ControlOrMeta` so the script runs on macOS as well as Windows/Linux |
| `label` | What the shortcut is doing, shown next to the keys. Written in the language the MR reviewer reads, like `mark()` |
| `target` | The element the shortcut acts on. Given one, the helper clicks it first (so the viewer sees the scope) and anchors the overlay to it |
| `pause`, `hold` | Override `pace.afterHotkeyMs` / `pace.hotkeyHoldMs` for this one press |

The overlay avoids covering what is being proved: it sits below the element, moves above it when
there is no room, then to the side. With no `target` it anchors to the current text selection (which
is exactly what `Cmd+C` acts on), then to the focused element, and only then falls back to the bottom
centre of the frame.

Key symbols follow the operating system doing the recording: a Mac shows `⌘ + C`, Windows and Linux
show `Ctrl + C`.

**A shortcut is not a shortcut through the UI.** Closing a modal, submitting a form, opening a menu —
if the UI has a real button, click it, because the viewer needs to see which button was pressed. Use
`hotkey()` only when the shortcut itself is what the MR has to prove, or when the UI offers no other
way.

## Proving what happens outside the browser

Some of what an MR changes never shows on the page. A button enqueues a job; a form writes a file; an
import moves rows. The click is visible and the result is not, and a video of the click alone proves
half of it.

`term` is a real shell on the machine doing the recording, drawn in a panel over the page. The
commands are real, the output is real, and it lands in the same video and the same runbook as
everything else.

```js
mark('Confirm the worker picked the job up');
await click(page.getByRole('button', { name: 'Run sync' }), { pause: 'observe' });

await term.open();
await term.start('tail -f log/worker.log');
await term.waitFor(/SyncJob .* finished/, { timeout: 30000 });
await shot('worker-finished');
await term.interrupt();
await term.run('ls -l tmp/exports');
await term.close();
```

| Call | Waits for | Use it for |
|---|---|---|
| `term.open()` | the panel to slide in and the shell to be ready | |
| `term.run(cmd)` | the command to exit; returns `{ exitCode, output }` | commands that finish |
| `term.start(cmd)` | the command to be typed and entered, nothing more | `tail -f`, a watcher, a server |
| `term.waitFor(pattern)` | a string or RegExp to appear in the output | the assertion that makes it evidence |
| `term.interrupt()` | the last `start` to stop, the way ^C would | stopping a `start` |
| `term.close()` | the panel to slide out | |

`term.run` throws when the command exits non-zero, because a failing command in a piece of evidence
is a broken take rather than a result — pass `{ allowFailure: true }` when the failure is the thing
being shown. `term.waitFor` throws on timeout, with the last lines of output in the message.

The pause after a command follows the same vocabulary as a click (`'quick' | 'normal' | 'observe'`,
or a number of milliseconds): `term.run('rake db:seed', { pause: 'quick' })`.

**Write `waitFor`, not `sleep`.** A fixed wait either fails the day the machine is busy or pads every
take with dead air, and neither one proves the line arrived. `waitFor` is also what the runbook
quotes as the assertion.

**The panel covers the bottom of the frame while it is open**, so `click()` refuses to operate on
anything behind it: the click would work and the video would not show it. Finish with the page
before opening the panel, or call `term.close()` before going back to it.

Three things it is not:

- **Not a terminal emulator.** Line-oriented output only. A full-screen program — `vim`, `less`,
  `htop`, anything that takes over the display — stops the take with an error saying so, rather than
  drawing something misleading.
- **Not interactive.** A command that waits on standard input hangs until the step times out. Pass
  what it needs on the command line or from a file.
- **Not a terminal.** Programs decide by themselves whether to buffer their output when nothing is
  watching, and one that buffers appears in bursts. `stdbuf -oL <command>` fixes it where it matters.
  Colour works for the tools that read `CLICOLOR_FORCE` and `FORCE_COLOR`; the rest need
  `--color=always`.

The commands run from the project root, in a shell that inherits the environment the runner was
started with — the `PATH` from rbenv, nvm or asdf still applies. `recording.terminal` in
`evidence.config.js` changes the directory, the environment and the panel's size.

The password of the account used to sign in is blacked out of the panel, the runbook and the
screenshots. Anything else your commands print that should not be in a video goes in
`recording.terminal.scrub`.

## Keeping something out of the finished video

An API key on screen, a customer's name, a token in a response. Whoever wrote the step knows
exactly when it appears, so they say so and nothing has to be found afterwards:

```js
await redact(page.locator('#api_key'), async () => {
  await click(page.getByRole('button', { name: 'Reveal' }), { pause: 'observe' });
  await shot('key-revealed');          // masked in the screenshot too
});
```

| mode | What it does | When |
|---|---|---|
| `blur` (default) | blurs the region for that stretch | something is there and its shape still tells the story |
| `box` | fills it with a solid block | the value must be unreadable, not merely hard to read |
| `cut` | removes the stretch from the video | it should never have been recorded at all |

Pass `'frame'` instead of a locator when the position is not known: `redact('frame', body)`.

**`cut` moves every timestamp after it.** The runbook is rebuilt against the shortened video, and
rows that fell inside the cut are dropped. That is handled, but it means the runbook of a take
with a cut cannot be compared against one without.

`shot()` inside a region window is masked over the same element by Playwright. Inside a `'frame'`
window, or a `cut` one, it is refused: an entirely blacked screenshot proves nothing, and a
screenshot of a stretch being removed defeats the point of removing it.

The runbook lists what was covered, when and where. A blurred rectangle in the middle of a video
reads as a rendering fault unless the reader is told it was deliberate.

Terminal output is separate: `recording.terminal.scrub` blacks out patterns before they are drawn
at all, so they never reach a frame to be blurred.

## What a recording cannot capture

The video records **page content**, not the machine's screen. Consequences:

- **`<select>`**: the expanded dropdown is drawn by the operating system, so it never enters the
  frame. The `select()` helper clicks the field and changes the selection with arrow keys (the
  viewer watches the value move), confirms the final choice through the data layer, and captions what
  was selected. It does not draw a fake menu: every way of doing that means restyling the real
  element, which makes the layout in the video differ from the layout of the app — and then the
  evidence is worthless.
- **The operating system's file picker**: not recordable. The `upload()` helper loads the file,
  pauses long enough for the filename to appear in the field, and captions which file was chosen.
  What can be proved is the state after choosing, not the dialog.
- **The browser's `confirm`/`alert` dialogs**: also drawn by the operating system. If the flow depends
  on them, take screenshots of the state before and after and say so plainly in the report.
- **The keyboard**: nothing on screen shows which key was pressed. The `hotkey()` helper compensates
  with the key hint overlay in the video, and the runbook lists the presses again with timestamps.

Widgets built in JS — modals, date pickers, a UI kit's dropdowns — record perfectly well. So does
anything that happens on the machine rather than in the page, through `term` above.

Everything in this list is about the default backend, which records page content. Setting
`recording.capture` to `'window'` records the browser window instead, and on macOS the file
picker, the JavaScript dialogs and the print sheet are all drawn inside it — so they do land in
the video. That backend needs a screen, Screen Recording permission and the operator's agreement,
and it cannot run headless or in CI, so it is worth reaching for only when one of these is the
thing being proved.

If the flow creates real data in the dev database (submitting a form that creates a record), say so
in the report so that whoever sees that data later knows where it came from.
