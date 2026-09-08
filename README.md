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

At some point you need to show that the app actually works: UAT, a hand-off to another team, a
bug report, a demo, a review. Recording it yourself takes about half an hour and the
video still looks bad — screenshots a beat late, the mouse jumping around, dropdowns that never
open on camera so nobody can tell what you picked.

Describe the flow to your coding agent instead. It drives Chrome and returns a video, screenshots
of the main steps, and a runbook so you can reproduce the same recording.

## Example

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
  <img src="./docs/demo/saucedemo.gif" width="820" alt="Swag Labs checkout recording: sign in, sort products by price (a subtitle notes the selected option because the OS-drawn dropdown cannot be captured), add a backpack to the cart, fill the checkout form, and finish the order.">
</p>

Eight screenshots of the main steps, plus a runbook so the person on the other end can read it
instead of watching:

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

While it records, it also watches the console and the network. That's how the reader finds out the
page was returning 401s — nothing a screenshot would show, and not something anyone was looking
for.

If you recorded in the same session where you were building the feature, the agent looks at those
screenshots and errors the way an e2e pass would. A 401, a layout that overflows or slips — it can
point them out and propose a fix, instead of only handing you the files.

The runbook also stores the exact command that produced the recording. If the data changed, the
video broke, or someone wants it slower, ask again. Old recordings are kept as `v1`, `v2`, … and
never overwritten — once you've sent a recording out, you can't recreate that exact file.

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

It asks which platform you use and tells you where things landed. Recording needs Chrome, ffmpeg and
Node — if one is missing, the agent names it and offers to install it.

Add `--ref main` or `--ref v1.2.0` to follow a branch or pin a version; `--ref latest` goes back to
releases. Update with `~/.webapp-evidence/scripts/install-local.sh --update`, remove it with
`--uninstall --all`.

## Using it

How you call it depends on where you are:

| platform | command |
|---|---|
| Claude Code | `/webapp-evidence:recording` |
| Cursor, Gemini CLI, Antigravity | `/webapp-evidence-recording` |
| Codex | `$webapp-evidence-recording` |

What you can ask for:

| You want | Say |
|---|---|
| Evidence of the screen you just changed | nothing after the command — it knows what you were working on |
| Evidence for an MR or PR | paste the link; it reads the description and diff |
| A page recorded from your description | `Page: <url>` and the steps, like the example above |
| The same recording again, or a slower one | just ask — the runbook keeps the command, and old takes are never overwritten |
| Captions in another language | say which; it remembers per project |
| A project set up once, so recordings start signed in | `set up the evidence config for this project` |

Write the steps in whatever language you use, and the agent replies in that language. There's no
syntax to memorise either — "get evidence for the screen I just fixed" works fine.

## Once you have a recording

| You want | Command |
|---|---|
| A gif, for a README or anywhere that only renders images | `/webapp-evidence:recording -f gif` |
| A webm, for a page you control | `/webapp-evidence:recording -f webm` |
| To know what the video shows, without watching it | `/webapp-evidence:vision <the mp4>` |

mp4 stays the default: it plays inline in a merge request, an issue and every chat tool, and it's the
smallest of the three. A gif of the same recording is several times larger, so you get an offer
rather than a surprise.

`vision` is there because an agent can't watch a video. It tiles one into sheets — a frame every
couple of seconds, each stamped `mm:ss` — and reads those as images. So a finding comes back as "the
header overlaps the table at 00:14", a time you can check yourself and match to the runbook. It picks
up what nobody thought to screenshot: a layout that breaks mid-transition, a banner that flashes and
is gone.

## Limits

It records the page, not your screen. OS-drawn UI stays out of the video: `<select>` dropdowns, the
file picker, `confirm`/`alert` dialogs. Those get a caption of what was chosen, plus a screenshot
of the state right after. Modals, date pickers, and JS dropdowns record normally.

Recording only runs against local dev or a site you name — never staging or production.

Videos and screenshots are not committed to Git. Attaching them to a ticket, MR/PR, or report is up
to you.

---

The recording above is real output from this repo's runner: `docs/demo/record.sh` produces it from
`docs/demo/saucedemo-steps.js`. If you want to work on the skill itself, see
**[CONTRIBUTING.md](./CONTRIBUTING.md)**.
