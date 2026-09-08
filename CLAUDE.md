# Working in this repository

This is a plugin that ships skills to five agent platforms. `CONTRIBUTING.md` explains the layout
and why it is shaped that way; this file is the short list of things that go wrong here.

## Adding or renaming a skill touches five platforms

A skill lives in `src/skills/<name>/`. The installer finds it by scanning that directory, so four
platforms pick it up on their own — and the fifth does not. Gemini CLI needs a hand-written
`commands/<plugin>-<name>.toml`, and nothing warns you when it is missing: the skill still loads
there, it just cannot be invoked by name.

Adding a skill therefore means:

1. `src/skills/<name>/SKILL.md` — frontmatter `name:` **must equal the directory name**, because
   Claude Code renders the command as `/<plugin>:<name>` and any difference shows up as two names
   for one thing.
2. `commands/<plugin>-<name>.toml` — the Gemini CLI entry.
3. Nothing else. The manifests point at `./src/skills/`, and `scripts/install-local.sh` derives the
   installed name as `<plugin>-<skill>` at install time.

`tests/platform-layer.test.js` fails if these fall out of step. Run it before you believe a rename
worked.

## Names, and why there are three

| name | comes from | who reads it |
|---|---|---|
| `webapp-evidence` | the repository, `.claude-plugin/marketplace.json`, every `plugin.json` | what a user installs |
| `recording`, `vision` | the directory under `src/skills/`, and the `name:` in its SKILL.md | Claude Code shows `/webapp-evidence:recording` |
| `webapp-evidence-recording` | derived by the installer, never written down | the four platforms with no namespace of their own |

Never write the derived name into a SKILL.md. It duplicates what `plugin.json` already says, and the
two will drift.

## Writing a SKILL.md

- **Short.** It enters the context every time the skill triggers. Detail that only one step needs
  belongs in `references/`, named from the table at the end of the skill.
- **Relative paths.** `node scripts/record.js`, never a variable to expand or a directory to search
  for. The platform that loaded the file already resolved where it lives.
- **No platform-only tools.** Where a capability differs, say what is needed and give the fallback in
  the same sentence.
- **Point at `--help`.** Every script answers it. Reading the source costs the whole file in context
  and says nothing extra, so the skill says so explicitly.
- **Say why, not just what.** These files are read by a model that follows reasoning better than it
  follows orders, and by a human deciding whether the rule still applies.

## Tests

```bash
npm install --prefix src/skills/recording/scripts --no-audit --no-fund   # first time only
node --test 'tests/*.test.js'     # everything, no browser needed
./tests/e2e/run.sh                # records the demo app in a real Chrome, needs ffmpeg
```

Assert behaviour, never message wording. A test that pins an exact sentence gets deleted the first
time somebody edits that sentence, and protects nothing after that. This is what let the whole runner
be translated to English without touching the suite.

`src/skills/recording/scripts/session.js` refuses to run from inside the skill directory, and this
repository *is* that directory — a test that loads it sets `PROJECT_ROOT` to a scratch directory
before the `require`.

## The demo in the README

`docs/demo/record.sh` records saucedemo.com through this repository's own runner and prints the
runbook next to the gif. The README quotes that runbook, so re-run the script rather than editing the
quote by hand.

The gif is encoded wider than the width the README displays it at. A gif scaled up by the browser
goes soft, and that softness is added at display time where no encoding effort can undo it.

## Git

The four READMEs are one document in four languages. Prose is translated; commands, paths and the
runbook excerpt stay byte-identical. Change one, change all four.

Recordings, screenshots and `accountStore` never enter the repository. The runner refuses to write
into a directory git does not already ignore, which is the guard rather than a convention to
remember.
