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
| `term.close()` | the panel to slide out | |

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

Three things it is not:

- **Not a terminal emulator.** Line-oriented output only. A full-screen program — `vim`, `less`,
  `htop`, anything that takes over the display — stops the take with an error saying so, rather than
  drawing something misleading.
- **Not interactive.** A command that waits on standard input hangs until the step times out. Pass
  what it needs on the command line or from a file.
- **Not a terminal.** Programs decide by themselves whether to buffer their output when nothing is
  watching, and one that buffers appears in bursts. `stdbuf -oL <command>` fixes it where it matters.
  Colour works for the tools that read `CLICOLOR_FORCE` and `FORCE_COLOR`; the rest need
  `--color=always`.

The commands run from the project root, in a shell that inherits the environment the runner was
started with — the `PATH` from rbenv, nvm or asdf still applies. `recording.terminal` in
`evidence.config.js` changes the directory, the environment and the panel's size.

The password of the account used to sign in is blacked out of the panel, the runbook and the
screenshots. Anything else your commands print that should not be in a video goes in
`recording.terminal.scrub`.

