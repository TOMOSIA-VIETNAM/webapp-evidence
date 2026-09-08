<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./docs/images/logo/logo-lockup-dark.svg">
    <img src="./docs/images/logo/logo-lockup.svg" alt="webapp-evidence" width="420">
  </picture>
</p>

<p align="center">
  <strong>The proof records itself.</strong><br>
  <sub>Ask once. Get a video, the screenshots, and a runbook you can hand to a reviewer.</sub><br>
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

Attaching proof to a merge request usually means a screenshot taken at the wrong moment, or a screen
recording where the mouse teleports, the dropdown never opens, and nobody can tell which button was
pressed. So most changes ship with no evidence at all, and the review goes ahead on trust.

## You ask for this

```
/webapp-evidence:recording Page: https://www.saucedemo.com
Flow:
1. Log in using standard_user / secret_sauce
2. Change the sort dropdown to "Price (low to high)"
3. Add "Sauce Labs Backpack" to the cart, then open the cart
4. Checkout, fill First Name / Last Name / Zip as Minh / Tang / 700000
5. Continue, then Finish, and stop at the "Thank you for your order!" screen
```

## You get this back

<p align="center">
  <img src="./docs/demo/saucedemo.gif" width="820" alt="A recording of the Swag Labs checkout: the cursor signs in, sorts the product list by price — a subtitle along the bottom says which option was chosen, because the dropdown is drawn by the operating system and cannot be filmed — adds a backpack to the cart, fills the checkout form, and finishes the order.">
</p>

Plus eight screenshots at the moments that matter, and a runbook a reviewer can read without
watching anything:

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

That last section is the part nobody expects. The runner watches the console and the network while
it records, so the reviewer learns the page was throwing 401s — something no screenshot would have
shown, and nobody was looking for.

The runbook also carries the exact command that reproduces the take. Data moved on, the video broke,
the reviewer wants it slower: ask again. The previous take is kept in `v1`, `v2`… rather than
overwritten, because evidence already sent with an MR is the one thing you cannot regenerate.

## Why it is worth a reviewer's time

- **The cursor is visible and moves like a hand** — a curved path, quick to accelerate, slow to
  brake, overshooting a distant target before correcting. Every click leaves a ripple.
- **The pace follows the screen.** Clicks that only navigate go briskly; the moment a result
  appears, it is held long enough to read.
- **What the frame cannot hold is said out loud.** A `<select>` menu and a file picker are drawn by
  the operating system and never enter a page recording — so a subtitle along the bottom says what
  was chosen. Keyboard shortcuts raise a key hint overlay (`⌘ + C`) beside the element they act on.
- **The page-load wait is trimmed**, so the video starts where the work starts.

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

It asks which platform you want. Recording needs Chrome, ffmpeg and Node on the machine — if
anything is missing, the agent says what and offers to install it.

Pinning to a branch or a release, and where each platform puts things:
**[Install](./docs/install.md)**.

## Calling it

| platform | how you call it |
|---|---|
| Claude Code | `/webapp-evidence:recording` |
| Cursor, Gemini CLI, Antigravity | `/webapp-evidence-recording` |
| Codex | `$webapp-evidence-recording` |

**Just finished a task or a bug fix.** The agent already knows which screen changed, so there is
nothing to type after it:

```
/webapp-evidence:recording
```

**All you have is the link.** It reads the MR/PR — description and diff — and works out what to
record:

```
/webapp-evidence:recording https://gitlab.example.com/group/admin/-/merge_requests/1783
```

**You don't write code.** Give the page and say what to show, the way the example above does. No
repository, no config, nothing to set up. Write the steps in whatever language you think in; the
agent replies in the same one.

There is no syntax to remember either — "get evidence for the screen I just fixed" does the same
thing.

## In a project

Point it at a project once and it learns how to get in:

```
/webapp-evidence:recording set up the evidence config for this project
```

It probes the login screen, finds a dev account, and writes an `evidence.config.js`. From then on
every recording starts signed in on a working environment without being asked.

Say what you want changed — "record it slower", "captions in Japanese", "keep only the newest take"
— and it edits that file for you.

## Limits worth knowing

The video records the page, not your screen, so anything the operating system draws stays out of
frame: `<select>` dropdowns, the file picker, `confirm`/`alert` dialogs. Those moments get a
subtitle saying what was chosen, plus a screenshot of the state afterwards. Modals, date pickers and
dropdowns built in JS record normally.

Recording runs against local dev or a site you name — never staging, never production.

Videos and screenshots stay out of Git. You attach them to the MR/PR yourself.

---

The recording above is real output from this repository's runner: `docs/demo/record.sh` produces it
from `docs/demo/saucedemo-steps.js`. Working on the skill itself? See
**[CONTRIBUTING.md](./CONTRIBUTING.md)**.
