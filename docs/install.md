# Install

get-evidence is one skill plus a Node runner. Every platform below reads the same
`src/skills/get-evidence/` — none of them gets a copy of its own — so an update reaches all of them
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
`scripts/install-local.sh` inside a clone at `~/.get-evidence` — that clone is what actually runs,
and it is worth reading afterwards.

```bash
curl -fsSL https://raw.githubusercontent.com/TOMOSIA-VIETNAM/webapp-evidence/main/install.sh | bash
```

Later on: `~/.get-evidence/scripts/install-local.sh --update` pulls and reinstalls,
`--uninstall --all` removes every install it made.

## Per platform

### Claude Code

Its own marketplace, no clone needed:

```bash
claude plugin marketplace add TOMOSIA-VIETNAM/webapp-evidence
claude plugin install webapp@webapp-evidence
```

The same two lines work as `/plugin marketplace add …` and `/plugin install …` inside a session.

Invoke it with `/webapp:get-evidence`. Claude Code namespaces every skill inside a plugin by the
plugin's name, which is why the command is longer here than on the other platforms — the plugin is
`webapp`, the skill inside it is `get-evidence`.

Updates are the marketplace's job: turn on auto-update for it in `/plugin` → **Marketplaces**, and
Claude Code picks up new commits shortly after a session starts. Nothing here pins a version, so
every commit on the default branch counts as a new one.

### Codex and Gemini CLI

Both read `~/.agents/skills`, so one install serves both:

```bash
curl -fsSL https://raw.githubusercontent.com/TOMOSIA-VIETNAM/webapp-evidence/main/install.sh | bash -s -- --platform shared
```

Codex invokes it as `$get-evidence`, or triggers it from a description of the task. Gemini CLI also accepts
`gemini extensions install https://github.com/TOMOSIA-VIETNAM/webapp-evidence`, which additionally
registers the `/get-evidence` command.

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

The CLI build additionally accepts `agy plugin install ~/.get-evidence`.

## Where it lands

| platform | directory |
|---|---|
| Claude Code | `~/.claude/plugins` (managed by the `claude` CLI) |
| Codex, Gemini CLI | `~/.agents/skills/get-evidence` |
| Cursor IDE | `~/.cursor/plugins/local/get-evidence` |
| Cursor CLI | `~/.cursor/skills/get-evidence` |
| Antigravity CLI | `~/.gemini/antigravity-cli/skills/get-evidence` |
| Antigravity IDE | `~/.gemini/config/skills/get-evidence` |

Each is a symlink into `~/.get-evidence` unless you pass `--copy`. The installer refuses to touch a
path it did not create, and `--uninstall` removes only what it wrote.

## Verifying

Claude Code is the only one that reports installation directly: `claude plugin list` shows
`get-evidence@get-evidence`. Everywhere else, start the agent and ask for evidence of a change — the
skill introduces itself by asking which screen and flow to record.

Installation onto Codex, Gemini CLI, Cursor and Antigravity has been verified as far as the files
landing in the directories each documents; it has not been exercised through an interactive session
on those platforms. Claude Code is the one this skill was built and used on.
