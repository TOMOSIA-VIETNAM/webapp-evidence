# Defects in the runner, found by recording with it

Four things that were already wrong before the panel was resized and the cases were added, found
by handing the skill to someone who had not read its source and watching where it led them. None
of them is fixed here. Each one is written with what it takes to see it happen.

## A take recorded without a config cannot be re-run from its own runbook

`OUT_DIR=… node scripts/record.js steps.js` with `BASE_URL` and no `evidence.config.js` records
fine. The runbook it writes names the site in its metadata — `config: (none — recorded with
BASE_URL=http://…)` — and then prints a re-run command with no `BASE_URL` in it, under a sentence
saying the command reproduces exactly this take. Running it in a clean directory stops with
`No evidence.config.js found.`

That section is what the skill tells people to open when a take has to be recorded again, so the
one path where the runbook is load-bearing is the one where it is wrong. `record.js` builds the
re-run line; `BASE_URL` reaches the metadata line beside it and not the command.

## A config that only sets pacing is refused

A recording driven by `BASE_URL` needs no config at all. Adding one to change a single pacing
number — nothing else in it — fails before the browser opens:

```
App "undefined" is not declared in the project config
```

So the cheapest possible customisation costs a `defaultApp` and an `apps.<name>.baseUrl` that the
run did not need and that now has to be kept in step with the `BASE_URL` being passed. Either a
config without apps should fall back to `BASE_URL`, or the message should say what to add.

## Any .png sitting in the output directory is counted as a screenshot

The count printed at the end of a run, and the total the report quotes, is every `*.png` in
`OUT_DIR`. The runbook's own list is narrower — it takes the `NN-name.png` shape and
`99-full-page.png`. Pull a frame out of the video with ffmpeg into that directory to look at
something, record again, and the run reports more screenshots than it took.

Two readings of the same directory that disagree; the looser one is the one the operator is shown.

## A command wider than the panel is cut off in the video

The panel draws one row per line and does not wrap, so a long command line runs off the right edge.
That was a deliberate choice — wrapping pushes the rows below it out of the panel — and it was
harmless while the commands were things a person typed by hand.

The request helper builds a line of about a hundred and sixty characters, which is wider than the
panel at most viewport widths. The full line is in the runbook, so nothing is lost; what is lost is
the video being able to stand on its own for the one thing it was recorded to show.

Worth deciding between: wrapping a command line only (not output), shrinking the font for the row
that overflows, or building a shorter line at the cost of what it shows.

## The step-script template asks for an app that a config-free take does not have

`assets/steps.example.js` opens with `app: 'admin'`, commented as the name of an app declared in
`evidence.config.js`. A recording driven by `BASE_URL` has no config and no app to name, and
`SKILL.md` says as much — without saying that the key can then be left out. Dropping it works: the
runner fills it in. Leaving it in, with a name nothing declares, does not.

The template is the first file anyone copies, and it is written for the path with a config only.

## The full-page screenshot is not in the count the operator was expecting

Every take also writes `99-full-page.png`, which nothing in `references/output-locations.md`
mentions. A step script that takes three screenshots is reported as having taken four, which reads
as a script that ran differently from how it was written.
