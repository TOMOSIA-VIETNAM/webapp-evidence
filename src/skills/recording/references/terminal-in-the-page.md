# A shell in the page

Read this when the change the recording has to prove is not on the page: a button enqueues a
job, a form writes a file, an import moves rows. The click is visible and the result is not, and
a video of the click alone proves half of it.

Everything else about writing a step script is in `writing-step-scripts.md`.

`term` is a real shell on the machine doing the recording, drawn in a panel over the page. The
commands are real, the output is real, and it lands in the same video and the same runbook as
everything else.

```js
mark('Confirm the worker picked the job up');
await click(page.getByRole('button', { name: 'Run sync' }), { pause: 'observe' });

await term.open();
await term.start('tail -f log/worker.log');
await term.waitFor(/SyncJob .* finished/, { timeout: 30000 });
await shot('worker-finished');
await term.interrupt();
await term.run('ls -l tmp/exports');
await term.close();
```

| Call | Waits for | Use it for |
|---|---|---|
| `term.open()` | the panel to slide in and the shell to be ready | |
| `term.run(cmd)` | the command to exit; returns `{ exitCode, output }` | commands that finish |
| `term.start(cmd)` | the command to be typed and entered, nothing more | `tail -f`, a watcher, a server |
| `term.waitFor(pattern)` | a string or RegExp to appear in the output | the assertion that makes it evidence |
| `term.interrupt()` | the last `start` to stop, the way ^C would | stopping a `start` |
| `term.script(path, contents)` | the file to be written, then `cat` and the run of it | a setup that genuinely is a file |
| `term.close()` | the panel to slide out | |

`term.script` writes the file before the panel opens and shows only the `cat` and the run, which is
what someone with that file already in their repository would do. It runs the file with `sh`; pass
`{ run: 'node seed.js' }` for anything else. Reach for it when the setup really is a file — a single
command is typed, and a shell file written to hold one line is two steps in the video where there
was one.

`term.run` throws when the command exits non-zero, because a failing command in a piece of evidence
is a broken take rather than a result — pass `{ allowFailure: true }` when the failure is the thing
being shown. `term.waitFor` throws on timeout, with the last lines of output in the message.

The pause after a command follows the same vocabulary as a click (`'quick' | 'normal' | 'observe'`,
or a number of milliseconds): `term.run('rake db:seed', { pause: 'quick' })`.

**Write `waitFor`, not `sleep`.** A fixed wait either fails the day the machine is busy or pads every
take with dead air, and neither one proves the line arrived. `waitFor` is also what the runbook
quotes as the assertion.

**The panel covers the bottom of the frame while it is open**, so `click()` refuses to operate on
anything behind it: the click would work and the video would not show it. Finish with the page
before opening the panel, or call `term.close()` before going back to it.

**The panel is sized to the command it is showing.** It sits at three rows between commands, grows
to fit the output as it arrives, and settles back when the next command needs less room.
`recording.terminal.height` is the tallest it may become, not the strip it occupies for the whole
take.

**Output longer than the panel is revealed, not clipped.** The window over it moves down at a
bounded speed, so every line the panel still holds is in a frame somewhere and a reviewer can pause
on any of them. That takes time in the video: the runner prints a `SLOW OUTPUT:` line naming any
command whose output took more than ten seconds to scroll past.

An output bigger than what the panel keeps gets a `LOST OUTPUT:` line instead, naming how many
lines fell off the top before the window reached them. Those are in no frame at all, so that take
proves less than it appears to and is worth recording again.

Either line is asking for a shorter command rather than a faster panel — pipe it through `jq`,
`head` or `grep`.

The runbook does not hold the output. It records each command, what it asserted and its exit code,
so the video is the only place the output itself survives — which is the reason a long one is worth
cutting down rather than leaving for the reader to scrub through.

Three things it is not:

- **Not a terminal emulator.** Line-oriented output only. A full-screen program — `vim`, `less`,
  `htop`, anything that takes over the display — stops the take with an error saying so, rather than
  drawing something misleading.
- **Not interactive.** A command that waits on standard input hangs until the step times out. Pass
  what it needs on the command line or from a file.
- **Not a pty.** Programs decide by themselves whether to buffer their output when nothing is
  watching, and one that buffers appears in bursts. `stdbuf -oL <command>` fixes it where it matters.
  Colour works for the tools that read `CLICOLOR_FORCE` and `FORCE_COLOR`; the rest need
  `--color=always`.

The commands run from the project root, in a shell that inherits the environment the runner was
started with — the `PATH` from rbenv, nvm or asdf still applies. `recording.terminal` in
`evidence.config.js` changes the directory, the environment, the panel's tallest size and how
opaque it is; the `panel…` keys in `recording.pace` change how fast it grows and reveals.

The password of the account used to sign in is blacked out of the panel, the runbook and the
screenshots — in what a command prints and in the command line itself. Anything else your commands print that should not be in a video goes in
`recording.terminal.scrub`.

