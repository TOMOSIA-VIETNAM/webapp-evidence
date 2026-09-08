# get-evidence

Record what your change does on the local dev app into **a video, screenshots and a runbook**, ready
to attach to an MR/PR — by asking your coding agent for it in plain words. Built and used on Claude
Code; installs onto Cursor, Codex, Gemini CLI and Antigravity, which read the same skill format.

The video is made for a person to watch: the mouse cursor is visible, every click leaves a ripple,
keyboard shortcuts raise a key hint overlay, the pace is slow enough to follow, and the page-load
wait is trimmed off the front. The cursor moves the way a hand moves — a slightly curved path, quick
to accelerate and slow to brake, overshooting a distant target before correcting — and clicks that
only navigate go briskly while the moments with a result to read are held longer.

## Install

Needs **Google Chrome**, **ffmpeg** and **Node.js** on the machine. On macOS: `brew install ffmpeg`.

Claude Code:

```bash
claude plugin marketplace add TOMOSIA-VIETNAM/webapp-evidence
claude plugin install webapp-evidence@webapp-evidence
```

Cursor, Codex, Gemini CLI, Antigravity:

```bash
curl -fsSL https://raw.githubusercontent.com/TOMOSIA-VIETNAM/webapp-evidence/main/install.sh | bash
```

It asks which platform you want and sets up the runner's dependency itself. Full guide, including
where each platform puts it and how to remove it: [Install](./docs/install.md).

## Using it

Type this in a chat session — `/webapp-evidence:get` on Claude Code, `/get-evidence` on Cursor,
Gemini CLI and Antigravity, `$get-evidence` on Codex. The examples below use the short form; on
Claude Code put `/webapp-evidence:` in front:

**You just finished a task or a bug fix — the agent already knows which screen changed:**

```
/get-evidence
```

**A fresh session with only an MR/PR link — the agent reads the MR and works out what to record:**

```
/get-evidence https://gitlab.example.com/group/admin/-/merge_requests/1783
```

**Naming the screen and the flow yourself:**

```
/get-evidence the /users/new screen, record filling the form and submitting
```

There is no syntax to remember — "get evidence for the screen I just fixed" works just as well.

**You don't write code?** Give the page and say what to show, in your own words:

```
/webapp-evidence:get record the search page at https://app.example.com/search:
type "abc", press Search, capture the results
```

No repository, no setup, nothing to install into a project — the agent opens the page, follows the
steps you described, and hands back the video and the screenshots with the folder they are in. Write
the steps in whatever language you think in; the agent replies in the same one.

## What you get

In the issue's evidence directory:

```
user-search.mp4                        the operation video
user-search-runbook.md                 timeline + shortcuts + captions + how to run it again
01-index.png … 99-full-page.png        screenshots, one per step
steps.js                               the recorded steps, editable and re-runnable
user-search-console.log                only present when the page had errors
```

The timeline lives in the runbook rather than being burned into the video, so fixing the wording
does not mean recording again. Ask for a re-record at any time — the data moved on, the video
broke, or the reviewer wants it slower.

Videos and screenshots are **not committed** to Git. Upload them to the MR/PR yourself.

## First time in a new project

The skill needs to know where the app runs, how to bring the environment up and how to log in. Ask
for that once:

```
/get-evidence set up the evidence config for this project
```

The agent probes the login screen, finds a dev account and writes an `evidence.config.js` into the
project. After that, asking for evidence is all it takes.

## Tuning it

Anything about the recording can be changed by asking — "record it slower", "captions in Japanese",
"keep only the newest take". The settings live in the project's `evidence.config.js`:

```js
recording: {
  speed: 'slow',                             // like video playback speed: 'fast' | 'normal' | 'slow' | 'slowest'
  captions: { enabled: true, locale: 'ja' }, // caption language: en | ja | vi
},
output: {
  overwrite: false,                          // false: previous takes are kept in evidence/v1, v2…
},
```

Frame size, video quality and the wait after each kind of action are adjustable too — saying what
you want is enough for the agent to find the right setting.

## Limitations

The video records the page, not your screen, so anything the operating system draws stays out of
frame: `<select>` dropdowns, the file picker, and the browser's `confirm`/`alert` dialogs.

Those moments instead carry **a caption inside the video** saying what was chosen and why the widget
is not visible, plus a screenshot of the state afterwards to prove the result. Before recording,
the agent asks whether to show captions and in which language (English by default; 日本語 for a
Japanese customer).

Keyboard actions leave no trace on screen either — so every shortcut raises a key hint overlay
(`⌘ + C`, with a description) next to where the action happens, and they are listed again with
timestamps in the runbook.

Modals, date pickers and dropdowns built in JS record normally.

Recording only ever runs against local dev — never staging, never production.

---

Working on the skill itself? See `CONTRIBUTING.md`.
