# Install

webapp-evidence is one skill plus a Node runner. Every platform below reads the same
`src/skills/recording/` — none of them gets a copy of its own — so an update reaches all of them
at once.

## Before anything

The runner drives a real Chrome and encodes the result, so the machine needs:

- **Google Chrome**
- **ffmpeg** — macOS: `brew install ffmpeg`
- **Node.js**

The installer sets up the runner's one npm dependency (`playwright-core`) itself and tells you if
Node or ffmpeg is missing. It never installs those for you.

## The one-liner

Works for every platform on this page. It asks which one you want, then hands over to
`scripts/install-local.sh` inside a clone at `~/.webapp-evidence` — that clone is what actually runs,
and it is worth reading afterwards.

```bash
curl -fsSL https://raw.githubusercontent.com/TOMOSIA-VIETNAM/webapp-evidence/main/install.sh | bash
```

Later on: `~/.webapp-evidence/scripts/install-local.sh --update` pulls and reinstalls,
`--uninstall --all` removes every install it made.

## Per platform

### Claude Code

Its own marketplace, no clone needed:

```bash
claude plugin marketplace add TOMOSIA-VIETNAM/webapp-evidence
claude plugin install webapp-evidence@webapp-evidence
```

The same two lines work as `/plugin marketplace add …` and `/plugin install …` inside a session.

Invoke it with `/webapp-evidence:recording`. Claude Code puts the plugin's name in front of every skill it
contains, so the skill itself is named for how it reads after that prefix. The other platforms have
no prefix to work with and install it as `webapp-evidence-recording`.

Updates are the marketplace's job: turn on auto-update for it in `/plugin` → **Marketplaces**, and
Claude Code picks up new commits shortly after a session starts. Nothing here pins a version, so
every commit on the default branch counts as a new one.

### Codex and Gemini CLI

Both read `~/.agents/skills`, so one install serves both:

```bash
curl -fsSL https://raw.githubusercontent.com/TOMOSIA-VIETNAM/webapp-evidence/main/install.sh | bash -s -- --platform shared
```

Codex invokes it as `$webapp-evidence-recording`, or triggers it from a description of the task. Gemini CLI also accepts
`gemini extensions install https://github.com/TOMOSIA-VIETNAM/webapp-evidence`, which additionally
registers the `/webapp-evidence-recording` command.

### Cursor

The IDE and the `cursor-agent` CLI read different places, so covering Cursor means both — which is
what `--platform cursor` does:

```bash
curl -fsSL https://raw.githubusercontent.com/TOMOSIA-VIETNAM/webapp-evidence/main/install.sh | bash -s -- --platform cursor
```

Teams and Enterprise accounts can instead import the repository URL as a team marketplace, which is
an admin action; the local install above is for everyone else.

### Antigravity

Its IDE and its CLI also read different directories, and `--platform antigravity` covers both:

```bash
curl -fsSL https://raw.githubusercontent.com/TOMOSIA-VIETNAM/webapp-evidence/main/install.sh | bash -s -- --platform antigravity
```

The CLI build additionally accepts `agy plugin install ~/.webapp-evidence`.

## Where it lands

| platform | directory |
|---|---|
| Claude Code | `~/.claude/plugins` (managed by the `claude` CLI) |
| Codex, Gemini CLI | `~/.agents/skills/webapp-evidence-recording` |
| Cursor IDE | `~/.cursor/plugins/local/webapp-evidence` |
| Cursor CLI | `~/.cursor/skills/webapp-evidence-recording` |
| Antigravity CLI | `~/.gemini/antigravity-cli/skills/webapp-evidence-recording` |
| Antigravity IDE | `~/.gemini/config/skills/webapp-evidence-recording` |

Each is a symlink into `~/.webapp-evidence` unless you pass `--copy`. The installer refuses to touch a
path it did not create, and `--uninstall` removes only what it wrote.

## Verifying

Claude Code is the only one that reports installation directly: `claude plugin list` shows
`webapp-evidence@webapp-evidence`. Everywhere else, start the agent and ask for evidence of a change — the
skill introduces itself by asking which screen and flow to record.

Installation onto Codex, Gemini CLI, Cursor and Antigravity has been verified as far as the files
landing in the directories each documents; it has not been exercised through an interactive session
on those platforms. Claude Code is the one this skill was built and used on.
