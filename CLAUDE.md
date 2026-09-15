# webapp-evidence

A plugin shipping skills to five agent platforms. `CONTRIBUTING.md` has the layout; this is what the
repository does differently.

## A new skill needs two files, not one

The installer scans `src/skills/*`, so four platforms pick a skill up on their own. Gemini CLI does
not — its entries are hand-written, and a missing one fails silently: the skill loads there but
cannot be invoked by name.

1. `src/skills/<name>/SKILL.md` — frontmatter `name:` equals the directory name
2. `commands/webapp-evidence-<name>.toml`

`tests/platform-layer.test.js` fails when these drift apart.

## Three names, one skill

| name | written in | read by |
|---|---|---|
| `webapp-evidence` | marketplace and every `plugin.json` | what a user installs |
| `recording`, `vision`, `feedback` | the directory, and `name:` in its SKILL.md | Claude Code: `/webapp-evidence:recording` |
| `webapp-evidence-recording` | nowhere — the installer derives it | the four platforms without a namespace |

Never write the derived name into a SKILL.md; `plugin.json` already holds that half of it.

## In a SKILL.md

- Relative paths: `node scripts/record.js`. The platform that loaded the file already resolved where
  it lives, so there is nothing to search for and no variable to expand.
- Point at `--help` rather than the source. Every script answers it.
- No tool only one platform has, unless the fallback is in the same sentence.

## Tests

```bash
npm install --prefix src/skills/recording/scripts --no-audit --no-fund   # first time
node --test 'tests/*.test.js'     # no browser needed
./tests/e2e/run.sh                # records the demo app in real Chrome
./tests/e2e/run-window.sh         # records the browser WINDOW — needs a screen and permission
./tests/e2e/run-native.sh         # the <select> menu, the browser's dialogs, optionally DevTools
```

The last two cannot run headless or in CI: they record what is on a screen, so they need Screen
Recording permission and the machine left alone for half a minute. `run.sh` covers everything
else, and both screen checks are macOS only — see `backlogs/screen-capture/other-platforms.md`.

Run `run-window.sh` when the capture backend or the crop arithmetic changes. It measures the
video against the rectangle the runner recorded, which is the only assertion that tells the whole
window from a piece of it: three earlier versions of that check passed on a crop of the top-left
quarter.

Assertions target behaviour, not message wording — that is what let the whole runner be translated
without touching the suite.

`session.js` refuses to run from inside the skill directory, and this repository is that directory:
a test loading it sets `PROJECT_ROOT` to a scratch dir before the `require`.

## Two things that break invisibly

**The README demo.** `docs/demo/record.sh` records saucedemo.com and prints the runbook the README
quotes. Re-run it instead of editing the quote. Its gif is encoded wider than the width the README
displays it at — scaled up by a browser, a gif goes soft, and no encoding effort undoes that.

**The four READMEs** are one document. Prose is translated; commands, paths and the runbook excerpt
stay byte-identical. Change one, change all four.
