---
name: get-evidence
description: Record evidence — an operation video, screenshots and a runbook — to attach to a pull or merge request. Use this whenever the user says "get evidence", "lấy evidence", "quay evidence", "chụp màn hình cho MR/PR", asks for proof or a recording of a change, or hands over an MR/PR link and wants evidence for it — including right after finishing a task or bug fix in the same session, when the screen and the flow are already known from context.
---

# get-evidence

Record what a change does on the project's local dev environment, as an mp4 of the operation plus
screenshots plus a runbook that says what happens at each point in the video and how to record it
again. The result is meant to be attached to a merge request by the user.

This skill knows nothing about any particular app. Everything project-specific — the URL, how to
bring the environment up, how to log in — lives in `evidence.config.js`. If the project has no such
file yet, build it first (see `references/project-setup.md`), then record.

Throughout this document `$SKILL` is the directory holding this SKILL.md file. Set it once and
reuse it:

```bash
SKILL=~/.claude/skills/get-evidence   # or .claude/skills/get-evidence inside a project
```

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
| The app is unknown, or the screen and flow cannot be derived | Ask the user, each question carrying a recommended option. On an agent with a structured question tool (Claude Code's `AskUserQuestion`), use it; otherwise ask in one chat message listing every option, and wait for the answer |

The flow has to follow what the MR actually changed. Wandering onto other screens makes the video
longer without proving anything more.

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
# Install the runner's dependency (first time only)
[ -d $SKILL/scripts/node_modules ] || npm install --prefix $SKILL/scripts --no-audit --no-fund

node $SKILL/scripts/inspect.js /path-of-the-screen
```

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
  node $SKILL/scripts/record.js <path to steps.js>
```

The runner brings the environment up (via `prepare` in the config), logs in (via `login`), records,
trims the page-load wait from the front, and writes the mp4 plus the runbook. Everything it fixed is
printed as a `FIXED: …` line — pass those lines into the report.

Both scripts have `--help` listing their arguments and environment variables. Call `--help` instead
of reading the source; they are written to be used as black boxes, and reading them only costs
context.

The login account is handled by the config and remembered in `accountStore`, so from the second run
onward there is nothing to ask the user. The login step is not part of the video.

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

`$SKILL` is shared by every project on the machine. Everything a recording produces — config,
accounts, step scripts, results, and throwaway experiment files — belongs to the project being
worked on. Litter left in the skill directory follows every other project that shares the install.

The trap: you need a scratch Playwright script, you notice `node_modules` already sits in
`$SKILL/scripts`, so you drop the file there to make `require` work. Keep the file in the project and
point `NODE_PATH` at the skill instead:

```bash
NODE_PATH=$SKILL/scripts/node_modules node <project directory>/scratch.js
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

Templates to copy from: `assets/evidence.config.example.js` and `assets/steps.example.js`.

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
