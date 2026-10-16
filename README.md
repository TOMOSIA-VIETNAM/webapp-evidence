<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./docs/images/logo/logo-lockup-dark.svg">
    <img src="./docs/images/logo/logo-lockup.svg" alt="Webapp Evidence" width="420">
  </picture>
</p>

<h3 align="center">Describe the flow. Get the recording.</h3>

<p align="center">
  <sub>
    <strong>English</strong> · <a href="./README.vi-VN.md">Tiếng Việt</a> · <a href="./README.ja-JP.md">日本語</a> · <a href="./README.zh-Hans.md">简体中文</a>
    &nbsp;&nbsp;|&nbsp;&nbsp; <a href="https://evdrec.vercel.app">evdrec.vercel.app</a> · <a href="./LICENSE">MIT</a>
  </sub>
</p>

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./docs/images/readme/pipeline-dark.svg">
    <img src="./docs/images/readme/pipeline.svg" width="900" alt="Describe a flow, the agent drives Chrome, and a video, screenshots and a runbook come back">
  </picture>
</p>

<p align="center">
  <a href="https://evdrec.vercel.app"><img src="./docs/demo/evd-tour.gif" width="820" alt="The webapp-evidence landing page recording itself: the command is copied, a terminal panel opens over the page and reads back the SEO meta it serves, then each acceptance criterion in the UAT report is picked and lights the runbook lines that prove it."></a><br>
  <sub>This project's own landing page, recorded by the skill it describes. One take, no editing.</sub>
</p>

## What one take proves

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./docs/images/readme/proofs-dark.svg">
    <img src="./docs/images/readme/proofs.svg" width="900" alt="One take showing the screen, the endpoint called with the browser's session, and the database row">
  </picture>
</p>

```
/webapp-evidence:recording Page: https://app.example.com/orders
Flow:
1. Create an order for SKU ABC, quantity 2
2. Call POST /api/orders and show it answering 201
3. Query the orders table and show the row that appeared
```

<sub>Cookies reach curl through a file, never the command line. A wrong status fails the take instead of
shipping as evidence. `recording.terminal.scrub` covers only the text it matches.</sub>

## Built for UAT

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./docs/images/readme/uat-dark.svg">
    <img src="./docs/images/readme/uat.svg" width="900" alt="Write the criteria, record one take, read the runbook, sign off; after a fix, record it again">
  </picture>
</p>

<p align="center"><sub>The recording above is that loop, run on this project's own site:
<a href="https://evdrec.vercel.app">evdrec.vercel.app</a> reads its take back as a UAT report.</sub></p>

## And without being asked

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./docs/images/readme/traits-dark.svg">
    <img src="./docs/images/readme/traits.svg" width="900" alt="Moves like a person, edited after you watch, catches console errors, stays on your machine">
  </picture>
</p>

<details>
<summary><b>What a runbook looks like</b> — the take above, as the person on the other end reads it</summary>

```markdown
## Steps in the video

00:05 - 00:17  Terminal — the SEO meta the page serves, read off its URL
00:24 - 00:40  UAT report — each criterion picks out the runbook lines that prove it
00:58 - 01:06  Install — one panel per agent

## Commands run in the terminal

- 00:12  `curl -s https://evdrec.vercel.app/ | grep -oE '<title>[^<]*</title>|…'` — exit 0

## Page errors recorded during the take

- none
```

</details>

## Read a take back

An agent cannot watch a video. `vision` tiles one into sheets stamped `mm:ss`, so a finding comes back
as *"the header overlaps the table at 00:14"*.

<p align="center">
  <a href="./docs/demo/vision-sheet-01.png"><img src="./docs/demo/vision-sheet-01.png" width="268" alt="Contact sheet 1 of the take above"></a>
  <a href="./docs/demo/vision-sheet-02.png"><img src="./docs/demo/vision-sheet-02.png" width="268" alt="Contact sheet 2 of the take above"></a>
  <a href="./docs/demo/vision-sheet-03.png"><img src="./docs/demo/vision-sheet-03.png" width="268" alt="Contact sheet 3 of the take above"></a>
</p>

## Install

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./docs/images/readme/platforms-dark.svg">
    <img src="./docs/images/readme/platforms.svg" width="900" alt="Runs in Claude Code, Cursor, Codex, Gemini CLI and Antigravity">
  </picture>
</p>

**Claude Code**

```bash
claude plugin marketplace add TOMOSIA-VIETNAM/webapp-evidence
claude plugin install webapp-evidence@webapp-evidence
```

**Cursor, Codex, Gemini CLI, Antigravity**

```bash
curl -fsSL https://raw.githubusercontent.com/TOMOSIA-VIETNAM/webapp-evidence/main/install.sh | bash
```

Needs Chrome, ffmpeg and Node — the agent names anything missing and offers to install it. Then type
`/webapp-evidence:recording` in Claude Code, `/webapp-evidence-recording` in Cursor, Gemini CLI and
Antigravity, `$webapp-evidence-recording` in Codex.

<details>
<summary><b>Pin a release, update, uninstall</b></summary>

```bash
curl -fsSL https://raw.githubusercontent.com/TOMOSIA-VIETNAM/webapp-evidence/main/install.sh | bash -s -- --ref v1.1.3
```

`--ref main` follows the branch and `--ref latest` goes back to releases; every later run stays on
whichever was asked for last. Update with `~/.webapp-evidence/scripts/install-local.sh --update`,
remove it with `--uninstall --all`.

</details>

## Ways to ask

No syntax to learn — *"get evidence for the screen I just fixed"* works, in any language.

| You want | Type |
|---|---|
| The screen you just changed | `/webapp-evidence:recording` |
| An MR or PR | `/webapp-evidence:recording https://gitlab.example.com/group/admin/-/merge_requests/1783` |
| The same take, data changed | `record that again` — old takes kept as `v1`, `v2`, … |
| Slower, or other captions | `record it slower`, `captions in Japanese` — remembered per project |
| A finished take, changed | `cover the API key in step 3`, `twice as fast` |
| A dropdown or dialog in frame | `--screen` — records the browser window |
| Never on your screen | `--headless` — the default |
| A gif or webm | `-f gif`, `-f webm` — mp4 otherwise |
| What a video shows | `/webapp-evidence:vision <the mp4>` |
| Takes that start signed in | `set up the evidence config for this project` |
| To report a problem | `/webapp-evidence:feedback` |

## Limits

It records the page, not your screen: `<select>` menus, the file picker and `confirm`/`alert` get a
caption and a screenshot instead — or `--screen`, which asks first. The terminal panel takes
line-oriented output, so `vim`, `less` and `htop` are out.

---

<sub>Every picture here is drawn by `docs/images/readme/build-readme-art.py`; the recording is
`docs/demo/record.sh` run on `webapp/`. To work on the skill itself, see
**[CONTRIBUTING.md](./CONTRIBUTING.md)**.</sub>
