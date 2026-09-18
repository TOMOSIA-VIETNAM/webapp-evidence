# Where results go, and what to report afterwards

Read this when choosing `OUT_DIR`, when the runner refuses to write there, and when turning the
runner's output into the final report.

## Choosing where results go

A recording is a heavy file that can be regenerated, so it belongs in the project's throwaway area,
not in the repository's history. Look for a location from nearest to furthest and stop at the first
match:

1. **The user named one** — take it, no discussion.
2. **The issue already has its own directory** (`backlogs/<issue>/`, `notebooks/<issue>/`, or
   whatever directory the session is already using for that issue) → write into an `evidence/`
   subdirectory inside it. An issue should have one directory tree; a second branch for the same work
   means whoever comes next has to look in two places.
3. **The project has a throwaway directory that is already ignored** and that other tools write into
   (often `notebooks/`) → `<that directory>/evidence/<issue>/`.
4. **Nothing to anchor to** → ask the user, with a concrete suggestion. Do not invent a new directory
   tree inside their repository.

Two constraints hold in every case:

- **The result has to be visible from where the user is standing.** They invoked the skill from
  `code/` and the result landed in a parent directory: as far as they are concerned it is lost. Do
  not climb above their working directory.
- **Do not edit `.gitignore`.** The location has to be an area the project *already* ignores. Adding
  an ignore line yourself and then declaring the condition met is working around the rule: that is
  editing someone's repository for a side task.

The issue directory in the second case is usually **untracked but not ignored** — people want to
commit the notes in it and only keep the video and screenshots out. Untracked sounds like enough, but
`git add -A` swallows untracked files, and once a video is in a commit it takes a history rewrite to
get it out. So it still has to be genuinely ignored.

The runner checks this and stops, printing the line that needs adding. Your job is to pass that line
to the user, wait for them to add it, and run again:

```
Ask the user to add one of the following lines to .gitignore, then run again:
  backlogs/1599-uat23/evidence/pr1606/
  backlogs/**/evidence/
```

The second line is the compact pattern covering every future issue, and is usually the one people
want. If they have considered it and still want to write into a non-ignored area, run again with
`EVIDENCE_ALLOW_TRACKED=1` — that decision is theirs, not the skill's.

`accountStore` has no such escape hatch: it holds passwords and stays around, so it must live in an
already ignored location.

## What a run produces

Inside `OUT_DIR`:

| File | Contents |
|---|---|
| `<name>.mp4` | The operation video |
| `<name>-runbook.md` | Everything needed to read it back and run it again: app, URL, config and step-script paths, the re-run command, **the timeline of steps**, the shortcuts pressed and captions shown with their timestamps (only when there were any), the screenshot list, the environment fixes, and the page errors seen |
| `NN-*.png` | Screenshots, numbered in capture order |
| `<name>-console.log` | **Only written when the page had errors** — console errors/warnings and requests returning 400 or above |
| `steps.js` | The step script, so the next run does not start by probing the screen again |
| `<name>-failed.mp4` | **Only written when a step script threw** — what was recorded before it stopped. There is no runbook for it: the take did not finish |

The runbook is the thing that makes a later re-recording cheap: open it, run the command inside. To
change what gets recorded, edit `steps.js`, not the runbook — the runbook is regenerated on every
run.

This directory sits in an already ignored area of the project, so the video and screenshots are
**not committed**; the user attaches them to the MR/PR themselves.

## When a take fails

The runner stops recording where the flow stopped, keeps what it had as `<name>-failed.mp4`, and
says which step it died in:

```
The take failed 00:41 in, during step 2, "Reach the audit trail below the fold":
locator.click: Timeout 30000ms exceeded.

What was recorded before it stopped: .../user-search-failed.mp4
```

Read that video before changing the step script: it usually shows the screen the step was waiting
on, which says whether the selector was wrong or the application never got there. Delete it once the
take has been re-recorded — it is not evidence of anything and it is not tidied up automatically.

## One project at a time

`record.js` and `inspect.js` both take a lock on the project before they start, and refuse while the
other one holds it:

```
Another take is already recording this project (process 51234, started 12s ago, writing to …).
```

It is a run that never started rather than one that failed, and probing raises it as readily as
recording does — both bring up the application's development server, and two runs share its state
and its build cache even when each has its own port. The one that loses that race gets a blank page,
or a 404 from a route the application defines, which points at everything except the other run.

Wait for the other one, or stop it. The message names the process holding the lock and the file to
delete if that process is not a run at all.

## Reporting back

If a previous take had to be moved aside, the runner prints an `ARCHIVED:` line before recording.
When it finishes it prints the block below — pass it through as it stands rather than compressing it
into "the recording is done":

```
VIDEO:   notebooks/spec/ISSUE-421/evidence/user-search.mp4  (39.3s, 527 KB)
RUNBOOK: notebooks/spec/ISSUE-421/evidence/user-search-runbook.md
SHOTS:   8 in notebooks/spec/ISSUE-421/evidence

PREVIOUS: v1 (1.2 MB), v2 (1.1 MB)
  Once there is nothing left to compare against, delete them: rm -rf .../v1 .../v2
```

They need the exact paths to open the files and drag them onto the MR, so do not make them go
looking.

When a `PREVIOUS:` line appears, ask whether the old takes are still needed and let the user decide —
do not delete anything yourself.

Add to the report, on top of the runner's own lines: the timeline content, whatever the runner fixed
in the environment (its `FIXED: …` lines), and any limitation hit along the way.

If there is a `PROBLEMS:` line, read the console log file before drawing a conclusion, and separate
three cases: the step script broke because a selector was wrong, the app is genuinely failing, or the
script caused the error **on purpose** (recording an invalid-input screen means a 4xx from the server
is the expected result). Say the third case plainly in the report so nobody reads it as a bug.

When the recording was taken in the same session as the implementation, also look at the screenshots
before you stop. Layout that overflows, overlaps or slips the viewport is a finding, same as a real
page error. Report it and propose a fix; do not apply the fix unless they ask. If the user is outside
the codebase, skip the proposal and just hand over the files.
