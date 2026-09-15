// The terminal helper handed to a step script: a real shell, shown in the page being recorded.
//
// This is the piece that joins the three parts that can each be tested on their own — the shell
// session, the screen model and the panel — and adds the two things that only make sense
// together: the prompt and the typing, which are drawn by the runner rather than echoed back by
// a terminal, and the log of what was run that ends up in the runbook.
const path = require('path');
const { createScreen } = require('./ansi');
const { createShell } = require('./shell');
const { createScrub } = require('./scrub');
const { resolvePause } = require('./human');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const PROMPT = '$ ';

// Matches the panel's own line-height and chrome. The runner sends only the rows that fit,
// because sending the whole scrollback and letting the browser clip it would put the newest
// lines below the bottom edge of the panel — the take would show output scrolling out of sight.
const LINE_HEIGHT = 1.45;
const PANEL_CHROME_PX = 28 + 24;   // the title bar, plus the padding above and below the text

// While a command is producing output there is nothing to await: the redraw is driven by a
// timer instead. Slower than a frame, because each redraw is a round trip to the browser, and
// faster than the eye needs to read a line appearing.
const REDRAW_MS = 90;

const visibleRows = (height, fontSize) =>
  Math.max(3, Math.floor((height - PANEL_CHROME_PX) / (fontSize * LINE_HEIGHT)));

// Programs that lay their output out in columns read COLUMNS when there is no terminal to ask.
// Getting this roughly right is the difference between `ls` filling the panel and `ls` printing
// one file per line.
const columnsFor = (viewportWidth, fontSize) =>
  Math.max(40, Math.floor((viewportWidth - 28) / (fontSize * 0.6)));

// A click under the open panel would work and would not be visible. The decision is its own
// function because it is the kind that goes wrong by one pixel and is never noticed: the video
// shows the panel where the button was, and the reviewer is left with a result and no action.
const isBehindPanel = (box, viewportHeight, panelHeight) =>
  box.y + box.height > viewportHeight - panelHeight;

function createTerminal({ page, viewport, config, human, pace, since, secrets = [], root }) {
  const { height, fontSize, shell: shellCommand, cwd, env, scrub: patterns, title } = config;
  const scrub = createScrub({ secrets, patterns });
  const screen = createScreen();
  const commands = [];

  const rows = visibleRows(height, fontSize);
  const label = title ?? path.basename(shellCommand[0]);

  let shell = null;
  let open = false;
  let redrawTimer = null;
  let dirty = false;
  let drawing = false;
  const started = [];      // process ids from start(), most recent last

  // The screen model refuses output it cannot draw honestly (a program that takes over the whole
  // display). That happens inside the shell's data handler, where there is nothing to throw to,
  // so it is turned into a rejection every pending and future step races against.
  let fatal = null;
  let signalFatal;
  const fatalSignal = new Promise((_, reject) => { signalFatal = reject; });
  fatalSignal.catch(() => {});   // raced against, so its rejection is always handled somewhere
  const guard = (promise) => (fatal ? Promise.reject(fatal) : Promise.race([promise, fatalSignal]));

  async function paint() {
    if (drawing) { dirty = true; return; }
    drawing = true;
    try {
      await page.evaluate((payload) => window.__evTerm?.sync(payload), {
        open,
        height,
        fontSize,
        title: label,
        lines: screen.lines().slice(-rows),
        cursor: open,
      });
    } catch {
      // The page can be navigating or already closed at the moment a redraw lands. The panel is
      // put back by the next paint, so a missed one is not worth failing a take over.
    } finally {
      drawing = false;
    }
    if (dirty) { dirty = false; await paint(); }
  }

  const markDirty = () => { dirty = true; };

  function startRedrawing() {
    if (redrawTimer) return;
    redrawTimer = setInterval(() => {
      if (!dirty || drawing) return;
      dirty = false;
      paint();
    }, REDRAW_MS);
  }

  function stopRedrawing() {
    if (!redrawTimer) return;
    clearInterval(redrawTimer);
    redrawTimer = null;
  }

  function ensureShell() {
    if (shell) return shell;
    shell = createShell({
      command: shellCommand[0],
      args: shellCommand.slice(1),
      cwd: cwd || root,
      env: { COLUMNS: String(columnsFor(viewport.width, fontSize)), ...env },
      scrub,
      onOutput: (text) => {
        try {
          screen.write(text);
          markDirty();
        } catch (error) {
          fatal = error;
          signalFatal(error);
        }
      },
    });
    return shell;
  }

  const writePrompt = () => {
    if (!screen.atLineStart()) screen.write('\n');
    screen.write(PROMPT);
    markDirty();
  };

  // The command is typed into the runner's own screen, not echoed back by a terminal. Same
  // rhythm as typing into a form field, so a take does not change pace when it moves from the
  // browser to the shell.
  async function typeCommand(text) {
    const characters = Array.from(text);
    const delays = human.typeDelays(text);
    const from = Date.now();
    let planned = 0;
    for (let i = 0; i < characters.length; i++) {
      screen.write(characters[i]);
      await paint();
      planned += delays[i];
      const behind = planned - (Date.now() - from);
      if (behind > 0) await sleep(behind);
    }
    screen.write('\n');
    await paint();
  }

  const record = (entry) => { commands.push({ at: since(), ...entry }); };

  const term = {
    async open() {
      ensureShell();
      await guard(shell.ready);
      open = true;
      writePrompt();
      await paint();
      startRedrawing();
      // Long enough for the panel to finish sliding in before anything is typed into it
      await sleep(320);
    },

    async run(command, { timeout, allowFailure = false, pause } = {}) {
      if (!open) await term.open();
      await typeCommand(command);
      const result = await guard(shell.run(command, timeout ? { timeout } : {}));
      record({ kind: 'run', text: command, exitCode: result.exitCode });
      writePrompt();
      await paint();
      // The output of a command is a result on screen, so it gets the same beat a click that
      // produces one gets. Without it the take moves on before the last line can be read.
      await sleep(human.wait(resolvePause(pause, pace, pace.afterCommandMs)));
      if (result.exitCode !== 0 && !allowFailure) {
        throw new Error(
          `\`${command}\` exited with code ${result.exitCode}.\n` +
          `${result.output.trim() || '(no output)'}\n\n` +
          'A failing command in a recording is a broken take, not a result. Pass ' +
          '{ allowFailure: true } if the failure is the thing being shown.'
        );
      }
      return result;
    },

    // For a command that does not end on its own. It is backgrounded so the shell stays
    // available, but no prompt is drawn: on screen it reads as the foreground command it stands
    // in for, and interrupt() ends it the way ^C would.
    async start(command, { timeout } = {}) {
      if (!open) await term.open();
      await typeCommand(command);
      const { pid } = await guard(shell.start(command, timeout ? { timeout } : {}));
      started.push({ pid, command });
      record({ kind: 'start', text: command });
      await paint();
      return { pid };
    },

    async waitFor(pattern, { timeout, hold } = {}) {
      if (!shell) throw new Error('There is nothing to wait for: no command has been run yet.');
      const match = await guard(shell.waitFor(pattern, timeout ? { timeout } : {}));
      record({ kind: 'wait', text: String(pattern), matched: match[0] });
      await paint();
      // The line that matched is the assertion the take rests on. It has just appeared, so hold
      // on it rather than moving on the instant the pattern is found.
      await sleep(human.wait(resolvePause(hold, pace, pace.afterCommandMs)));
      return match;
    },

    async interrupt() {
      const job = started.pop();
      if (!job) throw new Error('There is nothing to interrupt: no command was started.');
      screen.write('^C\n');
      await paint();
      await guard(shell.interrupt(job.pid));
      record({ kind: 'interrupt', text: job.command });
      writePrompt();
      await paint();
      await sleep(human.wait(pace.afterClickQuickMs));
    },

    async close() {
      if (!open) return;
      stopRedrawing();
      open = false;
      await paint();
      await sleep(300);   // the slide-out, so the last frame does not cut it in half
    },
  };

  return {
    term,
    commands,
    isOpen: () => open,
    panelHeight: height,
    // Closing the shell is separate from closing the panel: a take that ends with the panel
    // still on screen must not leave the shell, or whatever it was running, behind.
    async dispose() {
      stopRedrawing();
      if (shell) await shell.close();
    },
  };
}

module.exports = { createTerminal, isBehindPanel, visibleRows, columnsFor, PROMPT, LINE_HEIGHT, PANEL_CHROME_PX };
