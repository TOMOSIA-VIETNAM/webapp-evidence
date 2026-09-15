# Terminal panel — showing a real shell inside the recording

## The gap this closes

A recording proves what the browser did. It cannot prove what happened behind the browser: that
clicking "Run sync" enqueued a job, that a worker picked it up, that a file landed on disk. Today
the only way to show that is to record the screen, which drags in every OS permission and every
other window on the machine.

The shell does not have to be on the desktop to be real. A pseudo-terminal owned by the runner,
rendered into the page being recorded, runs the same commands against the same machine and
produces the same output — and stays inside the one surface that is already being captured.

## What it is

`record.js` spawns a shell on a pseudo-terminal. Output is parsed by the runner, then drawn into
an overlay panel in the page, next to the cursor and caption overlays that are already there. The
step script drives it through a `term` helper alongside `click` and `type`.

Everything stays in-page, so this works headless, needs no screen-recording or accessibility
permission, and runs in CI.

## What is real, and what is drawn

The question this design invites is whether any of it is staged. It is not, and the line falls in
one place:

| | |
|---|---|
| **Real** | the shell process, the command, the working directory and environment, the output bytes, the exit code, the file `tail -f` follows, the request `curl` makes, the rows a seed task writes |
| **Drawn by the runner** | the `$ ` prompt, the characters of the command appearing one at a time, the `^C`, the panel's title bar |

Nothing in the second column touches what the first column does. The runner draws the typing
because there is no terminal to echo it back, and draws the prompt because it does not use `PS1` —
cosmetic in both cases.

The consequence that matters: a take cannot come out green on a fabricated result. A command that
exits non-zero throws, and a `waitFor` whose line never arrives times out and fails the take. The
only way to a finished recording is for the thing to have actually happened.

The one thing it cannot reach is a process already running in somebody's own terminal window: that
output goes to that window's terminal, not to a file. What is logged to a file is visible; what
only ever appeared on another screen is not.

## What it is not

- **Not a terminal emulator.** Line-oriented output only: text, colours, `\r` progress lines.
  Full-screen programs that take over the display (`vim`, `htop`, `less`, anything using the
  alternate screen buffer) are refused with an error naming the limitation, not rendered wrong.
- **Not interactive.** A command that waits on stdin hangs until the step times out. Commands
  that need input take it on the command line or from a file.
- **Not a pty.** No job control, no window size, no terminal-detecting program changing its
  output because it thinks a human is watching.
- **Not a desktop driver.** Driving other applications is a separate piece of work.

## Step script API

```js
async run({ page, click, term, mark, shot }) {
  mark('Trigger the sync from the admin screen');
  await click(page.getByRole('button', { name: 'Run sync' }), { pause: 'observe' });

  mark('Confirm the worker picked the job up');
  await term.open();
  await term.start('tail -f log/worker.log');
  await term.waitFor(/SyncJob .* finished/, { timeout: 30000 });
  await shot('worker-finished');
  await term.interrupt();

  await term.run('ls -l tmp/exports');
  await term.close();
}
```

| call | waits for | use for |
|---|---|---|
| `term.open({ height })` | the panel to slide in and the shell to print its first prompt | |
| `term.run(cmd, { timeout })` | the command to exit; returns `{ exitCode, output }` | commands that finish |
| `term.start(cmd)` | the command to be typed and entered, nothing more | `tail -f`, servers, watchers |
| `term.waitFor(pattern, { timeout })` | `pattern` (string or RegExp) to appear in the output | the assertion that makes it evidence |
| `term.interrupt()` | Ctrl-C to be sent and the prompt to come back | stopping a `start` |
| `term.close()` | the panel to slide out | |

`term.run` throws on a non-zero exit code unless `allowFailure: true` is passed — a failing
command in a piece of evidence is a broken take, not a result, and it must not pass silently.
`term.waitFor` throws on timeout with the last lines of output in the message, because that is
what tells you whether the pattern is wrong or the app is.

Typing reuses the pacing in `human.js`, so a command is typed at a human rhythm and seeded from
the step script name — the same take reproduces.

## How the shell is run

An ordinary child process on pipes. No pseudo-terminal, and that is a deliberate reversal of the
obvious approach: `script` — the only way to get a pty without compiling a native module —
requires its own stdin to be a terminal, which a process spawned by an agent never has.

What a pty would have bought is bought more cheaply elsewhere:

- **The echo of the typed command.** The panel is drawn by the runner, so the runner types the
  command into its own screen model. Nothing needs to be echoed back.
- **The prompt and the exit code.** Rather than a `PS1` the runner has to recognise, the runner
  writes a sentinel command of its own after each command. The shell answers with a marker made
  of zero-width spaces around the exit code, so the marker never reaches the panel.
- **Ordering between stdout and stderr.** The session opens with `exec 2>&1`, so both arrive
  interleaved on one stream in the order they were written, which two separate pipes cannot
  promise.

What is genuinely lost is output buffering: a program writing to a pipe may buffer in 4KB blocks
rather than by line, and in a video that shows up as output arriving in bursts. `tail -f`, and
anything else that flushes as it goes, is unaffected. For a program that does not, the step
script prefixes `stdbuf -oL`. Colour is off for the same reason — `CLICOLOR_FORCE=1` and
`FORCE_COLOR=1` are set for the tools that honour them, and `--color=always` covers the rest.

The shell is `bash --norc --noprofile -s` by default, configurable. `--norc` keeps the take
independent of whoever's dotfiles are on the machine. The environment is inherited from the
runner process, so a `PATH` set up by rbenv, nvm or asdf in the operator's shell still applies.

### Knowing when a command has finished

The runner sends the command and a sentinel on the same write:

```
<command>
printf '<U+200B>%s<U+200B>' "$?"
```

The exit code arrives on the stream, framed by a character with no width, and is stripped before
anything is drawn.

`term.start` uses the same frame to report a process id instead: the command is backgrounded and
the shell answers with `$!`. That is what makes `term.interrupt()` possible without a pty — there
is no `\x03` to send and no job control to send it to, so the interrupt is `kill -INT <pid>`,
an ordinary command like any other.

A command that waits on stdin will consume the sentinel line and hang until the step times out.
The timeout message says so.

## What the panel draws

An overlay attached to `documentElement` with `pointer-events: none`, following the pattern the
cursor and caption overlays already use, including the MutationObserver that puts it back after a
framework swaps the body out. Scrollback lives on `window` so a re-attach does not lose it.

Handled: `\n`, `\r`, backspace, SGR colour and bold, erase-line. Other CSI and OSC sequences are
dropped. `\x1b[?1049h` (alternate screen) raises the "not a terminal emulator" error.

Because the panel covers the bottom of the frame, `click()` throws when the element it is about
to click sits under an open panel: the click would work and the video would not show it, and that
is exactly the kind of defect nobody notices until a reviewer asks.

## Secrets

Prevention first, redaction second.

The runner scrubs the raw stream before it reaches the page, the runbook, or a screenshot — one
`scrub()` function, one place to change.

- The password of the signed-in account is scrubbed by default. The runner already holds it via
  the account store, so this costs nothing and covers the one secret the skill itself introduces.
- `terminal.scrub` in the project config takes further patterns. There is no clever default list:
  a denylist that looks thorough and is not, is worse than none.

## Runbook

A new section lists every command with its timestamp and exit code, so a reviewer can read what
was run without scrubbing through the video:

```
## Commands run in the terminal

- 00:12  `tail -f log/worker.log`            (interrupted)
- 00:41  `ls -l tmp/exports`                 exit 0
```

`term.waitFor` records the pattern it matched and when, on the same list — that line is the
assertion the evidence rests on.

## Configuration

```js
// evidence.config.js
recording: {
  terminal: {
    height: 300,                       // panel height in px, within the 800px viewport
    shell: ['bash', '--norc', '--noprofile', '-i'],
    cwd: undefined,                    // defaults to the project root
    env: {},                           // merged over the inherited environment
    scrub: [/ghp_[A-Za-z0-9]{20,}/g],  // extra patterns, on top of the account password
    fontSize: 13,
  },
}
```

## Tests

Unit, no browser — the pure parts are where the bugs are:

- the pty stream parser: prompt markers, exit codes, split writes that cut a marker in half
- the ANSI renderer: colours, `\r` overwrite, backspace, erase-line, alt-screen refusal
- `scrub()`: the account password, configured patterns, and that the runbook gets the same
  treatment as the panel
- the command timeline rows

End-to-end, in `tests/e2e`: record a take against the demo app that runs a command, waits for a
pattern, and asserts both the runbook section and that the pattern text is legible in a frame.
