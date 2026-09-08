# Working on the skill

`README.md` covers installing and using it, `docs/install.md` covers every platform. This file is
for changing it.

Contributions are welcome. Before opening a pull request, run both checks — `node --test
'tests/*.test.js'` and `./tests/e2e/run.sh` — and say in the description which of them you ran,
since the end-to-end one needs a browser that not every machine has. A change to how a recording
behaves belongs with a test that would have caught the old behaviour; a change to wording does not
need one.

Two things this project deliberately does not accept: a rule about how to record living anywhere
other than `src/skills/recording/`, and a test that asserts on the exact text of a message. Both are
explained below.

## Layout

```
src/skills/recording/            the skill itself — the one copy every platform reads
  SKILL.md                 what an agent reads when the skill triggers
  references/              detail it loads only when a step needs it
  assets/                  templates a project copies: evidence.config.js, steps.js
  scripts/                 the runner — record.js, inspect.js and their modules
src/.claude-plugin/        plugin manifest, inside what Claude Code's marketplace ships
.claude-plugin/            the marketplace entry, pointing at ./src
.codex-plugin/  .cursor-plugin/  .agents/plugins/  plugin.json  gemini-extension.json
commands/webapp-evidence-recording.toml Gemini CLI's entry format
install.sh                 the one-liner: clone, then hand over
scripts/install-local.sh   the installer that knows every platform's directory
tests/                     unit tests and the platform-layer guards
tests/e2e/                 the demo app and the recording check that drives it
evals/                     queries for checking that the skill description triggers correctly
docs/install.md            the install page every README points at
```

## Where each name comes from

| name | declared in | who reads it |
|---|---|---|
| `webapp-evidence` | the repository, the marketplace catalog in `.claude-plugin/`, and every `plugin.json` | what a user adds and installs: `claude plugin install webapp-evidence@webapp-evidence` |
| `recording` | the directory name under `src/skills/` | Claude Code builds the command from the plugin name plus this: `/webapp-evidence:recording` |
| `webapp-evidence-recording` | the `name` in `SKILL.md` frontmatter | Codex, Cursor, Gemini CLI and Antigravity, which have no plugin layer and invoke the skill directly |

Claude Code namespaces every skill inside a plugin and there is no way out — putting `SKILL.md` at
the plugin root instead of under `skills/` was tried and changes nothing. It also builds the command
from the **directory** name, not the frontmatter, which is what makes `/webapp-evidence:recording`
possible: the namespace already says what this is about, so the skill part can be one short word.

The other four platforms read the frontmatter instead, and they have no namespace in front. A bare
`/recording` there would say nothing, so `scripts/install-local.sh` installs each skill under its
frontmatter `name` rather than its directory name. That mapping is the reason the two differ; if you
add a second skill, give it a directory that reads well after `webapp-evidence:` and a frontmatter
name that stands on its own.

No manifest declares a `version`. A git source falls back to the commit SHA, so every commit is a
new version and a client with marketplace auto-update on picks it up. Adding a `version` back means
nobody receives anything until someone remembers to bump it, and forgetting fails silently.

`claude plugin validate` warns about the missing version — `Consider adding a version following
semver`. That warning is the intended state, not something to fix. Validation still passes; only
`--strict` would treat it as an error, so don't add that flag to a check without changing this
decision first.

Two rules keep this from rotting:

**The skill exists once.** `src/skills/recording/` is what every platform installs — by symlink
into the clone, or by copy with `--copy`. There is no per-platform copy of the instructions to drift
out of sync, and nothing outside that directory contains a rule about how to record.

**Manifests stay out of what Claude Code ships.** Its marketplace entry declares `source: ./src`, so
a Claude install copies the skill and its plugin manifest and nothing else — no tests, no docs, no
other platform's manifest. Anything platform-specific therefore belongs at the repository root, not
under `src/`.

`SKILL.md` stays short because it enters the context every time the skill triggers. Anything needed
only at one step — setting a project up, writing a step script, choosing where results go — belongs
in `references/`, pointed at from the table at the end of `SKILL.md`.

Nothing in `SKILL.md` may name a tool only one platform has. Where a capability differs, say what is
needed and give the fallback in the same sentence — the way the question about captions names
Claude Code's structured question tool and then says what to do without one.

## Tests

```bash
npm install --prefix src/skills/recording/scripts --no-audit --no-fund   # first time only
npm test --prefix src/skills/recording/scripts       # or: node --test 'tests/*.test.js'
```

Two groups. The runner tests cover the decisions it makes without a browser — pacing, timeline rows,
config merging, which directory it may write into. The platform-layer tests cover the wiring that
only fails on someone else's machine: a manifest pointing at a directory that moved, `install.sh`
shipping less than a run needs, the Gemini command looking somewhere the installer never writes.

They assert behaviour rather than message wording, so rewording an error or translating the runner
does not turn them red. Keep it that way: a test that pins down an exact sentence gets deleted the
first time someone edits that sentence, and stops protecting anything.

`src/skills/recording/scripts/session.js` refuses to run from inside the skill directory, so a
test that loads it sets `PROJECT_ROOT` to a scratch directory before the `require`.

## The end-to-end check

The unit tests never open a browser, so they cannot tell you that a recording still happens. This
one does: it serves a demo app from `tests/e2e/app`, records it with the real runner in a real
Chrome, and asserts on what lands — an h264 mp4 long enough to hold the marked steps, at least four
screenshots, a runbook carrying the timeline and the captions, and no page-error log.

```bash
./tests/e2e/run.sh          # record, check, then delete the output
./tests/e2e/run.sh --keep   # keep it so you can watch the video
```

Needs Chrome, ffmpeg and Node, and takes about half a minute — most of which is the recording
playing out at the pace a viewer reads at. Output goes to a temporary directory outside the
repository, never into the working tree.

It also records with no `evidence.config.js` at all, driven by `BASE_URL`, which is the path someone
takes when all they have is a URL. That path has no other coverage.

CI runs it on every push, but as `continue-on-error`: a missing browser in a runner image should not
block a documentation change. The unit job is the one that gates.

## Trying an install without touching your own machine

```bash
HOME=/tmp/sandbox ./scripts/install-local.sh --platform shared,cursor,antigravity
find /tmp/sandbox -maxdepth 5            # check what landed
HOME=/tmp/sandbox ./scripts/install-local.sh --uninstall --all
```

Skip `--platform claude` in a sandbox: it drives the real `claude` CLI, which installs from GitHub
rather than from this clone.

Also worth breaking on purpose once: move a directory the manifests name and confirm the tests go
red. A guard nobody has seen fail is a guard nobody should trust.

## Running the runner by hand

Run **from a project directory**, never from inside the skill — the runner refuses to start when the
working directory is inside it, so that results never land in an asset shared by every project.

```bash
SKILL=~/.webapp-evidence/src/skills/recording     # or wherever it is installed

node $SKILL/scripts/record.js --help
node $SKILL/scripts/inspect.js --help

# list the interactive elements of a screen, to write a step script against
node $SKILL/scripts/inspect.js /path-of-the-screen

# record
OUT_DIR=<output directory> node $SKILL/scripts/record.js <path>/steps.js
```

## Checking that the description triggers

`evals/trigger-eval.json` holds twenty queries — ten that should trigger the skill, ten near-misses
that should not. The skill-creator plugin can run them:

```bash
cd ~/.claude/plugins/cache/claude-plugins-official/skill-creator/*/skills/skill-creator
python3 -m scripts.run_eval \
  --eval-set <this repo>/evals/trigger-eval.json \
  --skill-path <this repo>/src/skills/recording \
  --runs-per-query 1
```

Read the result with its harness in mind: it registers the skill as a slash command and runs
`claude -p` with the working directory set to a repository that holds no app to record. A run where
every positive query misses says more about that setup than about the description.
