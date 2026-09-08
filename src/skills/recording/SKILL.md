---
name: recording
description: Record evidence of a web app — an operation video, screenshots and a runbook — for a pull or merge request, a report, or a hand-off. Use when someone asks for proof that a change works, hands over an MR/PR link, or describes a page and the steps to capture on it.
---

# webapp-evidence-recording

Record what happens on a web page, as an mp4 of the operation plus screenshots plus a runbook that
says what happens at each point in the video and how to record it again.

Two kinds of people ask for this, and they arrive with different things in hand:

- **Someone working in the code** wants evidence for a merge request, on the project's local dev
  environment. They have a repository, an issue, and a change to prove.
- **Someone who does not write code** wants a page recorded — a URL and a description of what to
  click, to attach to a report, a hand-off, or a message to a supplier. There is no repository and
  nothing to build.

The second case needs less, not more: a URL is enough to start (`BASE_URL=<url>`), and there is no
config file to write. Do not walk someone through project setup they have no use for.

Everything project-specific — the URL, how to bring the environment up, how to log in — lives in
`evidence.config.js` when there is a project. If a project needs one and has none, build it first
(see `references/project-setup.md`), then record.

## Talking to the user

Write the recording — captions, `mark()` labels, hotkey labels — in the language the MR reviewer
reads, which the user tells you or the config pins down. That is a property of the evidence.

Reply to the user in the language they are writing to you in. This document and the runner's output
are English, but a Vietnamese-speaking user gets a Vietnamese report; the file paths, command lines
and runner labels inside it stay verbatim, because those are what they will copy and run.

## The path through a recording

1. **Work out the context**: which app, which issue (it names the output directory), which screen,
   which flow the MR needs to prove.
2. **Pick the evidence type**: screenshots alone, or video plus screenshots.
3. **Probe the screen** with `inspect.js` to get real selectors.
4. **Choose where the results go** — see `references/output-locations.md`.
5. **Settle the captions** — on or off, and in which language.
6. **Write `steps.js`** — see `references/writing-step-scripts.md`.
7. **Record**, then hand the user the runner's own output lines.

### Working out the context

| Situation | Where the context comes from |
|---|---|
| The user types "get evidence" in the session where the code was just written | The conversation itself: the task just finished, the screen or endpoint just changed. Do not ask again for what is already known |
| A fresh session, the user hands over an MR/PR link | Read the MR/PR — description plus diff — and derive the screen and the flow from it |
| The user gives a URL and describes what to show | Take the description as the flow. It is already the answer; do not translate it into a question about which code changed |
| The app is unknown, or the screen and flow cannot be derived | Ask the user, each question carrying a recommended option. On an agent with a structured question tool (Claude Code's `AskUserQuestion`), use it; otherwise ask in one chat message listing every option, and wait for the answer |

When the recording is for a merge request, the flow has to follow what that MR actually changed.
Wandering onto other screens makes the video longer without proving anything more. When it is for a
report or a hand-off, the same rule applies to what the user asked to show.

### When the request is a URL and a description

Someone outside the codebase says something like *"quay giúp tôi màn tìm kiếm ở
https://app.example.com/search: gõ 'abc', bấm Tìm, chụp lại kết quả"*. Everything needed is already
there. Work it as follows, and keep the questions to what you genuinely cannot see:

1. **Skip the config.** Pass `BASE_URL=<the url's origin>` to the runner instead of writing an
   `evidence.config.js`. That is what the fallback is for, and a config file would be a file they
   have no way to maintain.
2. **Probe the page** with `inspect.js` exactly as for any other recording — a description in words
   ("bấm nút Tìm") is not a selector, and the page is the only place the real one exists.
3. **Ask only about what is closed to you**: a sign-in the page requires and you have no account
   for, a step whose wording could mean two different buttons, or data you would have to invent.
   Never ask them to name a CSS selector, a file path, or a config key.
4. **Choose the output directory yourself** — the current working directory unless they named one —
   and tell them the full path at the end. See `references/output-locations.md`.
5. **Report in their words**, not in the runner's: what the video shows, how long it is, where the
   file is, and what they do next with it.

If the page needs signing in and they can share an account for it, use it for that one run and do
not write it to `accountStore` unless there is a project config that says where the store lives.

### Picking the evidence type

| The change | The evidence |
|---|---|
| A static screen, display-only change, one or two actions | Screenshots are enough |
| A multi-step flow — filling fields, submitting, modals, moving between screens | Video plus screenshots at the main moments |
| Recording is impossible for a technical reason | Screenshots at minimum, and say plainly in the report why there is no video |

### Probing the screen before writing anything

Do not guess selectors from memory or from reading the template — the running screen is the only
source that tells the truth, especially for JS-rendered UI.

```bash
node scripts/inspect.js /path-of-the-screen
```

Recording drives a real Chrome and encodes the result, so the machine needs Chrome, ffmpeg, Node and
the runner's own npm dependency. When something is missing the command says so. Do not walk the user
through installing it and do not paste instructions from here — offer to install it yourself, wait
for them to agree, then do it with whatever the machine already uses. Their machine, their call.

It prints buttons, inputs, selects (with their real option lists) and links, one usable selector per
line. Shared navigation chrome is filtered out; `--all` shows everything.

### Settling the captions

A recording cannot contain a `<select>` dropdown or a file picker — the operating system draws
those, and the video captures page content only. Captions fill that gap with a sentence saying what
was chosen and why the widget is not visible. But a caption is text drawn over the app, and its
language has to match the reviewer, so ask rather than decide alone.

Ask both questions in one round — one structured question call where the agent has one, otherwise a
single chat message — and wait for the answer:

| Question | Options |
|---|---|
| Show captions in the video? | On (recommended) / Off |
| Caption language? | English (default) / 日本語 / Tiếng Việt |

Then pass the answers to the recording command: `CAPTIONS=on|off`, `CAPTION_LOCALE=en|ja|vi`.

Do not ask when the answer already exists: the user said so in the conversation ("record it with
Japanese captions"), or `evidence.config.js` sets `recording.captions` — a config value is a
decision the project already made.

### Recording

```bash
OUT_DIR=<the issue's evidence directory> \
  CAPTIONS=on CAPTION_LOCALE=ja \
  node scripts/record.js <path to steps.js>
```

With no project config — a URL handed over by someone outside the codebase — name the site instead:

```bash
BASE_URL=https://app.example.com \
  OUT_DIR=<where the results go> \
  node scripts/record.js <path to steps.js>
```

The runner brings the environment up (via `prepare` in the config), logs in (via `login`), records,
trims the page-load wait from the front, and writes the mp4 plus the runbook. Everything it fixed is
printed as a `FIXED: …` line — pass those lines into the report.

Every script here — `record.js`, `inspect.js`, `convert.js` — answers `--help` with its arguments and
environment variables. Call that instead of reading the source. They are written to be used as black
boxes: the source is long, it is loaded into context in full when you open it, and it tells you
nothing `--help` does not.

The login account is handled by the config and remembered in `accountStore`, so from the second run
onward there is nothing to ask the user. The login step is not part of the video.

### Looking at the take

The screenshots and the page-error log are evidence for the reader. They are also for you.

When this recording happened in the same session as the implementation — the user just built or
changed the feature, then asked for evidence — read the screenshots and any `PROBLEMS:` log before
you stop. Look for real failures (not the expected 4xx from an invalid-input screen) and for layout
that is broken or slipping: overflow, overlap, a screen that clearly does not fit the viewport.

If you see one, say so and propose a fix. Do not apply it unless they ask. If the screenshots look
fine and the errors are expected, add nothing.

When the user is outside the codebase — a URL and a description, a hand-off, a report — just hand
over the files. A code fix they cannot apply is noise.

### Another format

The runner writes mp4, which plays inline in a merge request, an issue and every chat tool, and is
the smallest of the formats. A README that only renders images needs a gif; a web page you control
may prefer webm.

If the user asked for one — `-f gif`, `--format webm`, "make it a gif" — convert after recording:

```bash
node scripts/convert.js <the mp4> --to gif
```

If they did not, close the report by offering it in one line rather than converting on a hunch: a gif
of the same take is several times larger and looks worse. See `references/other-formats.md` for what
each format costs and where each one plays.

### Re-recording something that already exists

Every take leaves a `<name>-runbook.md` precisely so this costs nothing:

| Situation | What to do |
|---|---|
| Re-record unchanged (data moved on, the old video broke, another MR needs a fresh take) | Open the runbook and run the command in its re-run section |
| A few steps differ (extra action, different pacing, different timeline wording) | Edit `steps.js`, run the same command again |
| A selector broke because the UI changed | Probe that screen with `inspect.js` again, fix the selector in `steps.js`, re-run |

Previous takes are moved into `v1`, `v2`… before recording, so re-running loses nothing and does not
mix last run's screenshots into this one when the step count changes.

## Never write anything into the skill directory

This directory is shared by every project on the machine. Everything a recording produces — config,
accounts, step scripts, results, and throwaway experiment files — belongs to the project being
worked on. Litter left here follows every other project that shares the install.

The trap: you need a scratch Playwright script, you notice `node_modules` already sits in `scripts/`,
so you drop the file there to make `require` work. Keep the file in the project and point
`NODE_PATH` here instead:

```bash
NODE_PATH=<this skill directory>/scripts/node_modules node <project directory>/scratch.js
```

Before writing a scratch script at all, check whether `inspect.js` already answers the question —
"what is on this page, which selector do I use" is exactly what it is for.

The runner refuses to start if the working directory, `OUT_DIR` or the step script sits inside the
skill directory, so this surfaces immediately instead of accumulating quietly.

## Reference material

Read these when the step calls for them, not upfront:

| File | Read it when |
|---|---|
| `references/project-setup.md` | The project has no `evidence.config.js` yet, or the recording needs different pacing, captions or archiving behaviour |
| `references/writing-step-scripts.md` | Writing or editing `steps.js`: the helpers, how long to pause after each click, captions, keyboard shortcuts, and what a recording physically cannot capture |
| `references/output-locations.md` | Choosing `OUT_DIR`, dealing with the git-ignore check, and reading the runner's output to build the final report |
| `references/other-formats.md` | The take has to be a gif or a webm, and you need to know what that costs |

Templates to copy from: `assets/evidence.config.example.js` and `assets/steps.example.js`.

To look at a take rather than describe it — checking your own recording, finding where a layout
breaks, locating the moment an error appeared — the `vision` skill beside this one tiles a video into
timestamped sheets you can read as images.

## Out of scope

- Do not commit, do not push, do not attach anything to the MR/PR yourself.
- Do not write a password into the report or into any file other than `accountStore`.
- Do not create, edit or leave behind any file inside the skill directory.
- Do not edit the project's `.gitignore`, not even to legitimise a place to store results.
- Do not build a second directory tree for an issue that already has one.
- Do not delete old takes (`v1`, `v2`…) — suggest it and let the user decide.
- Do not touch staging or production; local dev only.
- Do not burn the timeline into the video — the explanation lives in the runbook so it can be fixed
  without recording again.
