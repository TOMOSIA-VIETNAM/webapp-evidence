---
name: feedback
description: Report a problem with webapp-evidence itself, or ask for something it cannot do yet, on its public issue tracker. Use when a recording came out wrong, a command failed, or the user says the tool should work differently. Writes nothing in the user's own repository.
---

# feedback

Turns what just went wrong into an issue on `TOMOSIA-VIETNAM/webapp-evidence`.

**Three things hold for every run of this, and nothing below overrides them:**

- **The destination is fixed:** `TOMOSIA-VIETNAM/webapp-evidence`. Never another repository, and
  never a write of any kind — issue, commit, config, file — in the user's own project.
- **An issue is public and cannot be unposted.** Nothing is created or commented until the user has
  seen the exact text and approved it.
- **It carries the problem, never the user's work.** A recording is made of somebody's application:
  their URLs, their customer names, their data. See "Strip what identifies them" below, and when a
  detail is borderline, drop it.

## 1. What is being reported

Take it from, in order: what the user said when they invoked this, then what this session shows —
which command they ran, what it produced, what they wanted instead.

Do not go reading their repository, their `evidence.config.js`, their recordings or their settings
to enrich the report. What is already in the conversation is what you have.

Nothing in either place — they invoked it bare, after a session with nothing to go on — ask one
open question: what should be different, and what prompted it. Then wait.

## 2. Strip what identifies them

A reader of the issue must not be able to tell which company, product or person it came from. This
tool records real applications, so the material in front of you is unusually rich in exactly the
things that must not travel.

| in front of you | goes in as |
|---|---|
| the app's URL or host, an MR/PR link, a ticket id | drop — "a page", "an internal app" |
| a screenshot, a video frame, a runbook, a console log | describe the behaviour in your own words |
| selectors, element ids, field labels from their UI | the kind of element — "a `<select>`", "a submit button" |
| the customer's or company's name, a product name, a person's name | drop |
| a file path inside their project, a branch, a SHA | its generic kind — "the evidence directory" |
| credentials of any sort, including the demo ones from their config | drop; never echoed, not even masked |
| the platform (Claude Code, Cursor…), the OS, Chrome and ffmpeg versions, our own output text | keep |

Their step script and their config are theirs. If the shape of one matters to the bug, describe the
shape — "a step script that uploads a file, then opens a modal" — rather than pasting it.

## 3. Draft it

English, whatever language the conversation is in. Title under 70 characters, stating the problem
rather than the feeling.

Pick one form and fill only its fields:

| what happened | form | label | fields |
|---|---|---|---|
| It misbehaved, crashed, recorded something wrong | `bug_report.yml` | `bug` | `description` = What happened · `steps` = How to reach it · `output` = What the runner printed · `version` = Version in use · `env` = Environment |
| It cannot do something, or could do it better | `feature_request.yml` | `enhancement` | `problem` = What you were trying to do · `solution` = What would help · `alternatives` = What you did instead |

One to three sentences per field. Leave `output` empty rather than pasting anything from step 2's
left column — the user can attach a screenshot themselves, in the browser, having looked at it.

Never put in any field: the conversation transcript, your own reasoning, a proposed patch, or an
apology.

Version:

```bash
claude plugin list 2>/dev/null | grep -A1 webapp-evidence
```

Nothing usable — another platform, or not installed as a plugin — write `unknown`.

## 4. Show it, then ask

If `gh` is installed and `gh auth status --hostname github.com` succeeds, look for the same thing
already reported:

```bash
gh search issues --repo TOMOSIA-VIETNAM/webapp-evidence --state all --limit 5 "<2-4 words from the title>"
```

Either step failing is fine — skip the search and go on.

Print the title and every filled field **verbatim**, not a summary of them, and say which form they
go to. Then ask once, with these options:

- **Post it** (recommended) — a public issue
- **Comment on #\<n\>** — only when the search found something close; name it, and any others
- **Edit first** — take their changes and redraft
- **Cancel** — nothing is sent

## 5. Send it

Write the body to a file first; a multi-line body cannot be quoted safely on a command line. Use
`${TMPDIR:-/tmp}/webapp-evidence-feedback.md`, with each field as `### <the field's label>` followed
by its content, in the form's order.

```bash
gh issue create --repo TOMOSIA-VIETNAM/webapp-evidence \
  --title "<title>" --label <label> --body-file "${TMPDIR:-/tmp}/webapp-evidence-feedback.md"
```

Commenting instead: `gh issue comment <n> --repo TOMOSIA-VIETNAM/webapp-evidence --body-file …`.

If `--label` is rejected because the label was renamed, run the same command without it.

**No `gh`, not authenticated, or the command failed:** print
`https://github.com/TOMOSIA-VIETNAM/webapp-evidence/issues/new/choose` on its own line, followed by
the title and the fields, for the user to paste into the form they pick. Say plainly that the issue
does not exist until they do that. Do not try a different repository.

## 6. Report back

Posted: give the URL `gh` printed, on its own line — that is where the maintainers will answer.

Not posted: say the issue does not exist yet and what they need to do.

Either way, once: nothing in their own repository was read or changed.
