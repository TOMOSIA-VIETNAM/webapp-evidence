<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./docs/images/logo/logo-lockup-dark.svg">
    <img src="./docs/images/logo/logo-lockup.svg" alt="webapp-evidence" width="420">
  </picture>
</p>

<p align="center">
  <strong>Describe the flow, get the recording.</strong><br>
  <sub>One command records your web app and returns a video, screenshots, and a runbook. For UAT, hand-offs, bug reports, and reviews.</sub><br>
  <code>/webapp-evidence:recording</code>
</p>

<p align="center">
  <a href="./LICENSE"><img alt="License: MIT" src="https://img.shields.io/github/license/TOMOSIA-VIETNAM/webapp-evidence?style=flat-square&color=blue"></a>
  <a href="#install"><img alt="Claude Code" src="https://img.shields.io/badge/Claude_Code-supported-D97757?style=flat-square&logo=anthropic&logoColor=white"></a>
  <a href="#install"><img alt="Cursor" src="https://img.shields.io/badge/Cursor-supported-000000?style=flat-square&logo=cursor&logoColor=white"></a>
  <a href="#install"><img alt="Codex" src="https://img.shields.io/badge/Codex-supported-412991?style=flat-square&logo=openai&logoColor=white"></a>
  <a href="#install"><img alt="Gemini CLI" src="https://img.shields.io/badge/Gemini_CLI-supported-4285F4?style=flat-square&logo=google&logoColor=white"></a>
  <a href="#install"><img alt="Antigravity" src="https://img.shields.io/badge/Antigravity-supported-6E56CF?style=flat-square"></a>
</p>

<p align="center">
  <strong>English</strong> · <a href="./README.vi-VN.md">Tiếng Việt</a> · <a href="./README.ja-JP.md">日本語</a> · <a href="./README.zh-Hans.md">简体中文</a>
</p>

Proving a feature works costs half an hour of screen recording, and the video still comes out
wrong: screenshots a beat late, the pointer jumping, a dropdown that never opens on camera. Describe
the flow to your coding agent instead. It drives Chrome and hands back a video, screenshots of the
main steps, and a runbook that reproduces the same take.

## Install

**Claude Code**

```bash
claude plugin marketplace add TOMOSIA-VIETNAM/webapp-evidence
claude plugin install webapp-evidence@webapp-evidence
```

**Cursor, Codex, Gemini CLI, Antigravity**

```bash
curl -fsSL https://raw.githubusercontent.com/TOMOSIA-VIETNAM/webapp-evidence/main/install.sh | bash
```

It asks which platform you use and says where things landed. Recording needs Chrome, ffmpeg and
Node; the agent names anything missing and offers to install it.

## Your first recording

Give it the page and the steps, in your own words:

```
/webapp-evidence:recording Page: https://app.example.com/search
Flow:
1. Search for "abc" with status Active
2. Open the first row, then close the detail panel
3. Export the result to CSV
```

Back come `<name>.mp4`, numbered screenshots, and `<name>-runbook.md` — the timeline, the captions,
the page errors seen, and the command that produced the take. Attach them to a ticket, an MR or a
report; nothing is committed to Git and nothing is sent anywhere.

There is no syntax to learn: *"get evidence for the screen I just fixed"* works, in whatever
language you write it, and the agent answers in that language. Where you type it:

| platform | command |
|---|---|
| Claude Code | `/webapp-evidence:recording` |
| Cursor, Gemini CLI, Antigravity | `/webapp-evidence-recording` |
| Codex | `$webapp-evidence-recording` |

## One take, three kinds of proof

A screen recording proves half of a full-stack change. The same take can call the API with the
session the browser is already holding, and read the database back — one video, one runbook:

```
/webapp-evidence:recording Page: https://app.example.com/orders
Flow:
1. Create an order for SKU ABC, quantity 2
2. Call POST /api/orders and show it answering 201
3. Query the orders table and show the row that appeared
```

- **The screen.** The form is filled in and submitted by a visible pointer, at the pace a viewer
  reads at.
- **The endpoint.** A terminal panel opens over the page and curl runs there with the browser's own
  cookies — `HTTP 201 in 0.184s` on camera. The step asserts the status, so a wrong one fails the
  take instead of shipping as evidence.
- **The database.** `psql`, `mysql`, a rake task — whatever you would run yourself, in that same
  panel, with the new row in the frame beside the screen that created it.

Cookies and tokens reach curl through a file and are masked everywhere: the video, the screenshots
and the runbook.

## What a take looks like

<p align="center">
  <img src="./docs/demo/site-tour.gif" width="820" alt="Landing page tour: the moth in the hero answers the pointer, the install command is copied and the button confirms it, then the page is read down through How it works, the review-round walkthrough clicked step by step, and the feature cards.">
</p>

This gif is one stretch of a longer take. Alongside it, the runbook says what the video shows, so
the person on the other end can read the take instead of watching it:

```markdown
## Steps in the video

00:21 - 00:26  Hero — copy the one-line install command
00:36 - 00:49  Review rounds — every step of the loop, picked by hand
01:13 - 01:26  The SEO meta the page serves, read straight off the URL

## Commands run in the terminal

- 01:24  `curl -s https://open-pr.vercel.app/ | grep -oE '<title>[^<]*</title>|…'` — exit 0

## Page errors recorded during the take

- none
```

It watches the console and the network while it records: a 401 from a call nobody was watching lands
in that last block with its status and URL. Recorded in the session where you built the feature, the
agent reads those screenshots and errors back the way an e2e pass would, and proposes a fix rather
than only handing over files.

## Ways to ask

| You want | Type this |
|---|---|
| Evidence of the screen you just changed | `/webapp-evidence:recording` — it knows what you were working on |
| Evidence for an MR or PR | `/webapp-evidence:recording https://gitlab.example.com/group/admin/-/merge_requests/1783` |
| The same take again, after the data changed | `/webapp-evidence:recording record that again` — old takes are kept as `v1`, `v2`, … |
| A slower take, or captions in another language | `/webapp-evidence:recording record it slower`, `captions in Japanese` — remembered per project |
| A secret kept out of the recording | `/webapp-evidence:recording blur the API key when it appears` |
| The dropdown or dialog itself in the video | `/webapp-evidence:recording --screen` — records the browser window, so what the OS draws is in frame |
| To stay off the screen, whatever the flow | `/webapp-evidence:recording --headless` — the default, and the way to settle the question outright |
| A gif for a README, or a webm for a page you control | `/webapp-evidence:recording -f gif`, `-f webm` — mp4 otherwise, because it plays inline everywhere |
| To know what a video shows, without watching it | `/webapp-evidence:vision <the mp4>` |
| Recordings that start signed in | `/webapp-evidence:recording set up the evidence config for this project` |
| To tell us something is wrong, or missing | `/webapp-evidence:feedback` |

`vision` exists because an agent cannot watch a video. It tiles one into sheets — a frame every
couple of seconds, each stamped `mm:ss` — so a finding comes back as "the header overlaps the table
at 00:14", a time you can check against the runbook. Sheets from the take above:
**[1](./docs/demo/vision-sheet-01.png)** ·
**[2](./docs/demo/vision-sheet-02.png)** ·
**[3](./docs/demo/vision-sheet-03.png)**.

## Limits

It records the page, not your screen. What the operating system draws stays out: `<select>`
dropdowns, the file picker, `confirm`/`alert` dialogs. Each gets a caption of what was chosen and a
screenshot of the state right after; modals, date pickers and JS dropdowns record normally. When one
of those dialogs *is* the evidence, `--screen` records the browser window instead — that needs a
screen, your permission and the machine left alone for the length of the take, so the agent asks
first.

The terminal panel takes line-oriented output: `vim`, `less` and `htop` are out. A recording runs
against the site you name, and nothing else.

To pin a version or follow a branch:

```bash
curl -fsSL https://raw.githubusercontent.com/TOMOSIA-VIETNAM/webapp-evidence/main/install.sh | bash -s -- --ref main
```

`--ref v1.1.3` pins a release, `--ref latest` goes back to releases, and every later run stays on
whichever was asked for last. Update with `~/.webapp-evidence/scripts/install-local.sh --update`,
remove it with `--uninstall --all`.

---

The recording above is real output from this repo's runner: `docs/demo/record.sh` produces it from
`docs/demo/site-tour-steps.js`. To work on the skill itself, see
**[CONTRIBUTING.md](./CONTRIBUTING.md)**.
