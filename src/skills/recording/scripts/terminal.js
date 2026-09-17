// The terminal helper handed to a step script: a real shell, shown in the page being recorded.
//
// This is the piece that joins the three parts that can each be tested on their own — the shell
// session, the screen model and the panel — and adds the two things that only make sense
// together: the prompt and the typing, which are drawn by the runner rather than echoed back by
// a terminal, and the log of what was run that ends up in the runbook.
//
// It also decides what part of the output is on screen at any moment. The panel is sized to the
// command it is showing and the window over the output moves at a bounded speed, so a command
// that prints more than fits does not have the middle of its output scroll past between two
// redraws and never appear in a single frame. Those are decisions, not drawing, so they are made
// here where they can be unit tested; the page is handed a window and a time to take reaching it.
const path = require('path');
const { createScreen } = require('./ansi');
const { createShell } = require('./shell');
const { createScrub } = require('./scrub');
const { resolvePause } = require('./human');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const PROMPT = '$ ';

// Matches the panel's own line-height and chrome. Both sides work in rows and have to agree on
// what a row is: the runner decides how far to scroll in rows, the page turns that into pixels.
const LINE_HEIGHT = 1.45;
const PANEL_CHROME_PX = 28 + 24;   // the title bar, plus the padding above and below the text

// What the panel comes back to between commands. Not zero: a panel that slides fully out and back
// for every command is motion that means nothing, and three rows keep the shell present in the
// frame while giving the application back the room a command that printed a lot had borrowed.
const IDLE_ROWS = 3;

// While a command is producing output there is nothing to await: the redraw is driven by a
// timer instead. Slower than a frame, because each redraw is a round trip to the browser, and
// faster than the eye needs to read a line appearing.
const REDRAW_MS = 90;

// How far either side of the visible window the rows handed to the page reach. The window moves
// by less than a row between two redraws, so a couple of rows of slack is all the animation
// between them can cross. The scrollback behind that is deliberately not sent: it would be
// thousands of elements rebuilt eleven times a second, inside the page being recorded, to draw
// rows that are clipped out of the panel anyway.
const PAINT_MARGIN_ROWS = 4;

// The screen model drops its oldest rows once it is full, and a row it has dropped is a row no
// frame can still show. The window walks the buffer at a bounded speed, so the buffer has to
// outlast that walk by a wide margin rather than hold the handful of screens a terminal keeps
// for a person scrolling back.
const SCROLLBACK_ROWS = 2000;

const visibleRows = (height, fontSize) =>
  Math.max(IDLE_ROWS, Math.floor((height - PANEL_CHROME_PX) / (fontSize * LINE_HEIGHT)));

const idleHeight = (fontSize) => PANEL_CHROME_PX + Math.ceil(IDLE_ROWS * fontSize * LINE_HEIGHT);

// The height that shows `rows` rows of output, never smaller than the idle panel and never taller
// than `recording.terminal.height`. That configured number used to be the panel's one fixed
// height; it is now the tallest it may become, so a project that pinned it gets the same worst
// case as before and a smaller panel for every command that does not need the room.
const heightFor = (rows, fontSize, { base, ceiling }) =>
  Math.max(base, Math.min(ceiling, PANEL_CHROME_PX + Math.ceil(rows * fontSize * LINE_HEIGHT)));

// How fast the window over the output may travel, given how many rows are still waiting below it.
//
// The speed is whatever clears the backlog in `panelRevealMs`, so a command printing twice as
// much does not take twice as long to get through. It is bounded at both ends: below
// `panelRowSlowestMs` per row a short overflow crawls, and above `panelRowFastestMs` per row a
// paused frame is the only way to read anything — and pausing is the viewer's move to make, so
// there is nothing left to buy by going faster.
function revealPlan(backlogRows, pace) {
  const rows = Math.max(0, backlogRows);
  const fastest = 1000 / pace.panelRowFastestMs;
  const slowest = 1000 / pace.panelRowSlowestMs;
  const rowsPerSecond = Math.min(fastest, Math.max(slowest, (rows * 1000) / pace.panelRevealMs));
  return { rowsPerSecond, durationMs: (rows / rowsPerSecond) * 1000 };
}

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
  const {
    height: ceiling, fontSize, opacity, shell: shellCommand, cwd, env, scrub: patterns, title,
  } = config;
  const scrub = createScrub({ secrets, patterns });
  const screen = createScreen({ maxLines: SCROLLBACK_ROWS });
  const commands = [];

  const idle = idleHeight(fontSize);
  const label = title ?? path.basename(shellCommand[0]);

  let shell = null;
  let open = false;
  let redrawTimer = null;
  let dirty = false;
  let drawing = false;
  const started = [];      // process ids from start(), most recent last

  // Where the panel is and where it is going. All of it is counted in rows of the screen model,
  // from its first line, so that one number means the same thing to the sizing and to the scroll.
  let blockStart = 0;        // the prompt row of the command being shown
  let firstRow = 0;          // the row at the top of the panel; fractional while it is moving
  let panelPx = idle;        // the height the panel is being animated towards
  let paintedPx = idle;      // the height the page was last told, to tell a grow from a shrink
  let paintedRow = 0;        // the window position the page was last told, to tell a move from a hold
  let movedAt = Date.now();  // when the window was last advanced, for the elapsed time
  let settleUntil = 0;       // new content is left still until here before the window moves on
  let scrolledMs = 0;        // how long this command's output has been scrolling
  // Set when a command is typed, cleared by its first line of output, which in turn asks the next
  // redraw to bring the panel down to what that command needs. Until then the panel keeps the
  // height the previous command earned: emptying it out and refilling it within the same second
  // is two moves where the eye only needs the one that lands.
  //
  // Two steps rather than one because the resize has to happen where the window is worked out as
  // well. Shrinking the panel anywhere else moves its bottom edge and leaves the window where it
  // was, and the output jumps back up by the difference at the moment the next command starts.
  let awaitingFirstOutput = false;
  let sizeDownToCommand = false;

  // The screen model refuses output it cannot draw honestly (a program that takes over the whole
  // display). That happens inside the shell's data handler, where there is nothing to throw to,
  // so it is turned into a rejection every pending and future step races against.
  let fatal = null;
  let signalFatal;
  const fatalSignal = new Promise((_, reject) => { signalFatal = reject; });
  fatalSignal.catch(() => {});   // raced against, so its rejection is always handled somewhere
  const guard = (promise) => (fatal ? Promise.reject(fatal) : Promise.race([promise, fatalSignal]));

  const capacity = () => visibleRows(panelPx, fontSize);

  // The last row the window can reach: put it at the top and the newest line is on the bottom row.
  const lastWindow = () => Math.max(0, screen.rowCount() - capacity());

  const atRest = () => firstRow >= lastWindow();

  // Moves the panel and the window on by however long has passed since this was last called.
  // Everything the page is told follows from the two positions it works out, so it runs once per
  // paint and nowhere else.
  function advance() {
    const now = Date.now();
    // A redraw the event loop was too busy to run must not be paid back as a jump: the point of
    // a bounded speed is that no row crosses the panel without being in a frame.
    const elapsed = Math.min(now - movedAt, REDRAW_MS * 4);
    movedAt = now;

    const total = screen.rowCount();
    const fitted = capacity();     // what the panel holds before this redraw resizes it
    if (sizeDownToCommand) { sizeDownToCommand = false; panelPx = idle; }
    // Only ever taller while a command runs: output that made room for itself must not lose it
    // again because the line after it was shorter. sizeDownToCommand is the one way back down.
    panelPx = Math.max(panelPx, heightFor(total - blockStart, fontSize, { base: idle, ceiling }));
    // A resize moves the panel's edges, not the output inside it: whatever was on the bottom row
    // stays there and the room opens upwards, so neither direction skips past anything.
    firstRow += fitted - capacity();
    firstRow = Math.max(0, Math.min(firstRow, lastWindow()));

    const backlog = lastWindow() - firstRow;
    if (backlog <= 0) { settleUntil = 0; return; }
    // Text that appears and moves in the same instant is text nobody's eye reached in time. The
    // beat is measured from the redraw the new content first arrived in, so a command that keeps
    // printing is not held up again for every line after the first.
    if (!settleUntil) { settleUntil = now + pace.panelSettleMs; return; }
    if (now < settleUntil) return;

    const { rowsPerSecond } = revealPlan(backlog, pace);
    firstRow = Math.min(lastWindow(), firstRow + (rowsPerSecond * elapsed) / 1000);
    scrolledMs += elapsed;
  }

  async function paint() {
    if (drawing) { dirty = true; return; }
    drawing = true;
    try {
      advance();
      const all = screen.lines();
      // From just above the window — where the move this redraw asks for starts — to just below
      // what the panel can show once it has arrived.
      const linesFrom = Math.max(0, Math.floor(firstRow) - PAINT_MARGIN_ROWS);
      const height = panelPx;
      await page.evaluate((payload) => window.__evTerm?.sync(payload), {
        open,
        height,
        // Which way it is moving decides how long it takes: fast enough not to delay the output
        // it is making room for, slower coming back down, because a panel that snaps reads as a
        // glitch. Both are scaled by the take's speed, like every other duration in a recording.
        heightMs: height === paintedPx ? 0 : (height > paintedPx ? pace.panelGrowMs : pace.panelShrinkMs),
        fontSize,
        opacity,
        title: label,
        lines: all.slice(linesFrom, Math.ceil(firstRow) + capacity() + PAINT_MARGIN_ROWS),
        linesFrom,
        scrollRow: firstRow,
        // The page is given long enough to reach the row asked for just as the next redraw lands,
        // so the window moves at the browser's frame rate. Handed a slice at a time instead, the
        // motion could never be smoother than eleven steps a second, and a line-by-line cut is
        // what makes a long output unreadable in the first place.
        scrollMs: firstRow === paintedRow ? 0 : REDRAW_MS,
        cursor: open,
      });
      paintedPx = height;
      paintedRow = firstRow;
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
    movedAt = Date.now();
    redrawTimer = setInterval(() => {
      // The window keeps moving after the output has stopped arriving, until it has reached the
      // end of what was printed.
      if (drawing || (!dirty && atRest())) return;
      dirty = false;
      paint();
    }, REDRAW_MS);
  }

  function stopRedrawing() {
    if (!redrawTimer) return;
    clearInterval(redrawTimer);
    redrawTimer = null;
  }

  // A line has not been shown until the window has walked far enough down for it to be inside the
  // panel. Returning before that is what used to leave the middle of an output in the runbook and
  // in no frame of the video.
  //
  // The row waited on is the one at the end of the buffer at the moment of the call, not wherever
  // the end has moved to since, so this still finishes for a command that is printing as it goes.
  async function revealThrough(row) {
    while (firstRow + capacity() < row) {
      if (!redrawTimer) await paint();
      await sleep(REDRAW_MS);
    }
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
          if (awaitingFirstOutput) {
            awaitingFirstOutput = false;
            sizeDownToCommand = true;
          }
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
    // The prompt row is where this command's block begins, and the block is what the panel is
    // sized to. Everything above it belongs to the command before.
    blockStart = Math.max(0, screen.rowCount() - 1);
    awaitingFirstOutput = true;
    scrolledMs = 0;
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
      await revealThrough(screen.rowCount());
      record({ kind: 'run', text: command, exitCode: result.exitCode });
      // A response nobody will read is a step script that piped nothing into `jq`, not a panel to
      // scroll faster: every line was shown, which for an output this long is most of the take.
      // Said once, with the command that did it, where the operator will see it.
      if (scrolledMs > pace.panelRevealWarnMs) {
        console.log(
          `SLOW OUTPUT: \`${command}\` took ${(scrolledMs / 1000).toFixed(1)}s to scroll past in ` +
          'the panel. Cut it down with jq, head or grep and record again — the full output is in ' +
          'the runbook either way.'
        );
      }
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
      // The matched line can still be below the window while the output that carried it is being
      // walked through. Holding on a line the frame does not contain proves nothing.
      await revealThrough(screen.rowCount());
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
      await revealThrough(screen.rowCount());
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
    // Asked of the page rather than answered from here: this file knows the height the panel is
    // being animated towards, and a click lands while it is still on its way there.
    async panelHeight() {
      if (!open) return 0;
      try {
        const covered = await page.evaluate(() => window.__evTerm?.coveredFrom() ?? null);
        if (covered !== null) return viewport.height - covered;
      } catch {
        // A page mid-navigation has nothing to measure. The height being animated towards is the
        // same answer a fraction of a second later, and refusing a click is the safe way to be
        // wrong: the alternative is a click nobody can see in the video.
      }
      return panelPx;
    },
    // Closing the shell is separate from closing the panel: a take that ends with the panel
    // still on screen must not leave the shell, or whatever it was running, behind.
    async dispose() {
      stopRedrawing();
      if (shell) await shell.close();
    },
  };
}

module.exports = {
  createTerminal, isBehindPanel, visibleRows, idleHeight, heightFor, revealPlan, columnsFor,
  PROMPT, LINE_HEIGHT, PANEL_CHROME_PX, IDLE_ROWS,
};
