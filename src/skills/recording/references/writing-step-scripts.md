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
| a click that raises `alert`/`confirm` | `dialog(async () => click(locator))` — see below |

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

## Two things that need their own file

| The claim | Read |
|---|---|
| The click reached a worker, wrote a file, moved a row — `term` opens a real shell in the page | `terminal-in-the-page.md` |
| Something on screen must not survive into the evidence — `redact()` covers it, in the video and the screenshot | `redaction.md` |

## A dialog the browser puts up

`alert`, `confirm`, `prompt`, `beforeunload`. Two things make these need a helper rather than an
ordinary click, and both look like the take hanging:

- Playwright dismisses a dialog the instant it appears unless something is listening, so by
  default one never reaches the screen at all.
- The click that raises it does not return until the dialog is answered. Awaiting the click
  first waits forever.

```js
mark('Confirm the deletion');
await dialog(async () => {
  await click(page.getByRole('button', { name: 'Delete selected' }), { pause: 'quick' });
});
await shot('deleted');
```

`{ accept: false }` presses Cancel instead; `{ text: '…' }` answers a `prompt`. The runbook lists
what was asked and what was answered, whichever backend recorded the take.

Nothing may talk to the page while a dialog is up — every evaluate and every mouse move blocks on
it — so the cursor and the captions stay still for the duration, which is also what a real dialog
looks like.

A modal the application draws itself is ordinary page content. Click it like anything else.

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
- **The browser's `confirm`/`alert` dialogs**: drawn by the browser, over the page rather than in
  it. `dialog()` drives them, and its own section is below — a click that raises one and is
  awaited never returns.
- **The keyboard**: nothing on screen shows which key was pressed. The `hotkey()` helper compensates
  with the key hint overlay in the video, and the runbook lists the presses again with timestamps.

Widgets built in JS — modals, date pickers, a UI kit's dropdowns — record perfectly well. So does
anything that happens on the machine rather than in the page, through `term` — see
`terminal-in-the-page.md`.

Everything in this list is about the default backend, which records page content. Setting
`recording.capture` to `'window'` records the browser window instead, and on macOS the file
picker, the JavaScript dialogs and the print sheet are all drawn inside it — so they do land in
the video. That backend needs a screen, Screen Recording permission and the operator's agreement,
and it cannot run headless or in CI, so it is worth reaching for only when one of these is the
thing being proved.

If the flow creates real data in the dev database (submitting a form that creates a record), say so
in the report so that whoever sees that data later knows where it came from.
