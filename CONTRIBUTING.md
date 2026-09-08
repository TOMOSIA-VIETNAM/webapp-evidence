# Working on the skill

`README.md` covers installing and using it, `docs/install.md` covers every platform. This file is
for changing it.

## Layout

```
src/skills/get-evidence/   the skill itself — the one copy every platform reads
  SKILL.md                 what an agent reads when the skill triggers
  references/              detail it loads only when a step needs it
  assets/                  templates a project copies: evidence.config.js, steps.js
  scripts/                 the runner — record.js, inspect.js and their modules
src/.claude-plugin/        plugin manifest, inside what Claude Code's marketplace ships
.claude-plugin/            the marketplace entry, pointing at ./src
.codex-plugin/  .cursor-plugin/  .agents/plugins/  plugin.json  gemini-extension.json
commands/get-evidence.toml Gemini CLI's entry format
install.sh                 the one-liner: clone, then hand over
scripts/install-local.sh   the installer that knows every platform's directory
tests/                     unit tests for the runner, plus guards for the platform layer
evals/                     queries for checking that the skill description triggers correctly
docs/install.md            the install page every README points at
```

## Three names, on purpose

| name | where it comes from | what it does |
|---|---|---|
| `webapp-evidence` | the repository, and the marketplace catalog in `.claude-plugin/` | what a Claude Code user adds |
| `evidence` | every `plugin.json` | the namespace Claude Code puts in front of the skill: `/evidence:get-evidence` |
| `get-evidence` | `SKILL.md` frontmatter, and the directory under `src/skills/` | what Codex, Cursor, Gemini CLI and Antigravity invoke directly |

Claude Code namespaces every skill inside a plugin, and there is no way to opt out — putting
`SKILL.md` at the plugin root instead of under `skills/` does not change it. Naming the plugin
`evidence` rather than `get-evidence` is what keeps the command from reading
`/get-evidence:get-evidence`.

No manifest declares a `version`. A git source falls back to the commit SHA, so every commit is a
new version and a client with marketplace auto-update on picks it up. Adding a `version` back means
nobody receives anything until someone remembers to bump it, and forgetting fails silently.

`claude plugin validate` warns about the missing version — `Consider adding a version following
semver`. That warning is the intended state, not something to fix. Validation still passes; only
`--strict` would treat it as an error, so don't add that flag to a check without changing this
decision first.

Two rules keep this from rotting:

**The skill exists once.** `src/skills/get-evidence/` is what every platform installs — by symlink
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
npm install --prefix src/skills/get-evidence/scripts --no-audit --no-fund   # first time only
npm test --prefix src/skills/get-evidence/scripts       # or: node --test 'tests/*.test.js'
```

Two groups. The runner tests cover the decisions it makes without a browser — pacing, timeline rows,
config merging, which directory it may write into. The platform-layer tests cover the wiring that
only fails on someone else's machine: a manifest pointing at a directory that moved, `install.sh`
shipping less than a run needs, the Gemini command looking somewhere the installer never writes.

They assert behaviour rather than message wording, so rewording an error or translating the runner
does not turn them red. Keep it that way: a test that pins down an exact sentence gets deleted the
first time someone edits that sentence, and stops protecting anything.

`src/skills/get-evidence/scripts/session.js` refuses to run from inside the skill directory, so a
test that loads it sets `PROJECT_ROOT` to a scratch directory before the `require`.

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
SKILL=~/.get-evidence/src/skills/get-evidence     # or wherever it is installed

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
  --skill-path <this repo>/src/skills/get-evidence \
  --runs-per-query 1
```

Read the result with its harness in mind: it registers the skill as a slash command and runs
`claude -p` with the working directory set to a repository that holds no app to record. A run where
every positive query misses says more about that setup than about the description.
