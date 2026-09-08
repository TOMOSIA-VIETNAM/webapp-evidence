<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./docs/images/logo/logo-lockup-dark.svg">
    <img src="./docs/images/logo/logo-lockup.svg" alt="webapp-evidence" width="420">
  </picture>
</p>

<p align="center">
  <strong>Describe the flow. Get the recording.</strong><br>
  <sub>One command records your web app and hands back a video, the screenshots and a runbook — for UAT, hand-offs, bug reports and reviews.</sub><br>
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

Sooner or later somebody has to see the app actually work: a UAT sign-off, a hand-off to another
team or a supplier, a bug report, a demo, a code review. Recording it yourself takes half an hour
and still looks bad. The screenshot lands a second too late. The mouse jumps across the screen. The
dropdown never opens on camera, so nobody can tell what you picked.

So describe the flow to your coding agent instead. It drives Chrome and hands back a clean video,
screenshots of the moments that matter, and a runbook that reproduces the take.

## What you type

```
/webapp-evidence:recording Page: https://www.saucedemo.com
Flow:
1. Log in using standard_user / secret_sauce
2. Change the sort dropdown to "Price (low to high)"
3. Add "Sauce Labs Backpack" to the cart, then open the cart
4. Checkout, fill First Name / Last Name / Zip as Minh / Tang / 700000
5. Continue, then Finish, and stop at the "Thank you for your order!" screen
```

## What you get

<p align="center">
  <img src="./docs/demo/saucedemo.gif" width="820" alt="A recording of the Swag Labs checkout: the cursor signs in, sorts the product list by price — a subtitle along the bottom says which option was chosen, because the dropdown is drawn by the operating system and cannot be filmed — adds a backpack to the cart, fills the checkout form, and finishes the order.">
</p>

Eight screenshots of the moments that matter. And a runbook, so whoever receives it can read the
take instead of watching it:

```markdown
## Steps in the video

00:00 - 00:01  Open the sign-in screen
00:01 - 00:08  Sign in as standard_user
00:08 - 00:13  Sort the product list by Price (low to high)
00:13 - 00:16  Add Sauce Labs Backpack to the cart
00:16 - 00:19  Open the shopping cart
00:19 - 00:26  Enter the customer information
00:26 - 00:29  Review the order summary
00:29 - 00:36  Finish the order

## Captions shown in the video

- 00:10  Selected "Price (low to high)". The dropdown menu is drawn by the operating
         system, so it does not appear in this recording.
- 00:31  The order is placed on the public saucedemo.com demo site, so no real data
         is created.

## Page errors recorded during the take

- [http 401] https://events.backtrace.io/api/unique-events/submit…
```

That last section is the bonus. While it records, it also watches the console and the network — so
here the reader learns the page was returning 401s. No screenshot would have shown that, and nobody
was looking for it.

The runbook also keeps the exact command that produced the take. Data moved on, video broken, the
reader wants it slower? Ask again. Old takes are kept as `v1`, `v2`, … and never overwritten,
because a take you have already sent out is the one thing you cannot regenerate.

## Why the video is watchable

- **The cursor is visible and moves like a hand.** It curves, starts fast, brakes slowly, and
  overshoots a far target before correcting. Every click leaves a ripple.
- **The pace follows the screen.** Clicks that only navigate go quickly. When a result appears, it
  is held long enough to read.
- **Anything the camera misses is said in a caption.** A `<select>` menu or a file picker is drawn
  by the operating system and never reaches a page recording, so a subtitle along the bottom says
  what was chosen. Keyboard shortcuts get a key hint (`⌘ + C`) next to the element they act on.
- **Page-load waiting is cut out**, so the video starts where the work starts.

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

It asks which platform you use, then tells you where it put everything. Recording needs Chrome,
ffmpeg and Node — if one is missing, the agent names it and offers to install it.

The one-liner installs the newest release, or `main` while there are no releases yet. Use `--ref` to
pick something else; it is remembered, so later updates keep you where you asked to be:

```bash
curl -fsSL … /install.sh | bash -s -- --ref main       # a branch, to try a change before it ships
curl -fsSL … /install.sh | bash -s -- --ref v1.2.0     # a release, to pin a team to one version
curl -fsSL … /install.sh | bash -s -- --ref latest     # back to following releases
```

Update with `~/.webapp-evidence/scripts/install-local.sh --update`, remove with `--uninstall --all`.
One catch: `install.sh` is always downloaded from the default branch, so a fix to the installer
itself only reaches you after it is merged there.

## Three ways to ask

| platform | how you call it |
|---|---|
| Claude Code | `/webapp-evidence:recording` |
| Cursor, Gemini CLI, Antigravity | `/webapp-evidence-recording` |
| Codex | `$webapp-evidence-recording` |

**You just finished a task or a bug fix.** The agent already knows which screen changed, so type
nothing after it:

```
/webapp-evidence:recording
```

**You only have the link.** It reads the MR/PR — description and diff — and works out what to
record:

```
/webapp-evidence:recording https://gitlab.example.com/group/admin/-/merge_requests/1783
```

**You don't write code.** Give it the page and say what to show, like the example above. No
repository, no config, nothing to set up. Write the steps in whatever language you think in; the
agent answers in the same one.

There is no syntax to memorise either — "get evidence for the screen I just fixed" does the same
thing.

## Point it at your project once

```
/webapp-evidence:recording set up the evidence config for this project
```

It finds the login screen and a dev account, then writes an `evidence.config.js`. After that every
recording starts already signed in, on an environment that works, without asking you again.

To change something, say it — "record it slower", "captions in Japanese", "keep only the newest
take" — and it edits that file for you.

## Limits worth knowing

It records the page, not your screen. So anything the operating system draws stays out of frame:
`<select>` dropdowns, the file picker, `confirm`/`alert` dialogs. Those moments get a caption saying
what was chosen, plus a screenshot of the state right after. Modals, date pickers and dropdowns
built in JS record normally.

Recording runs against local dev or a site you name — never staging, never production.

Videos and screenshots stay out of Git. Attaching them — to the ticket, the MR/PR, the report — is
yours to do.

---

The recording above is real output from this repository's runner: `docs/demo/record.sh` produces it
from `docs/demo/saucedemo-steps.js`. Working on the skill itself? See
**[CONTRIBUTING.md](./CONTRIBUTING.md)**.
