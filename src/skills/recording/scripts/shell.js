// The shell session behind the terminal panel. Owns the child process and the protocol that
// tells the runner when a command has finished; knows nothing about the screen or the page.
//
// It runs on plain pipes rather than on a pseudo-terminal. The obvious route — `script`, the one
// way to get a pty without compiling a native module — needs its own stdin to be a terminal, and
// a process spawned by an agent has no terminal anywhere in sight. What the pty was wanted for
// turns out to be available without it:
//
//   the echo of the typed command   the panel is drawn by the runner, which types into it
//   the prompt and the exit code    a sentinel command the runner sends itself, see below
//   stdout and stderr in order      `exec 2>&1` at the start, so there is only one stream
//
// The one real loss is buffering: a program writing to a pipe may flush in blocks rather than by
// line. `tail -f` and anything else that flushes as it goes is unaffected; for a program that is
// not, the step script prefixes `stdbuf -oL`.

const { spawn, execFileSync } = require('child_process');

// Zero-width space. The frame has to be something that can cross the stream without being drawn:
// a marker the viewer can see is a marker the viewer has to be told to ignore.
const FRAME = '​';

const DEFAULT_TIMEOUT_MS = 30000;
const TAIL_LINES = 12;

const tail = (text) => text.split('\n').slice(-TAIL_LINES).join('\n').trimEnd();

function timeoutError(what, output) {
  const seen = tail(output);
  return new Error(
    `${what}\n` +
    (seen
      ? `Last output from the shell:\n${seen}`
      : 'The shell produced no output at all. A command that reads standard input hangs here, ' +
        'because the session has no terminal to type into.')
  );
}

// Splits the shell's output into text and sentinels. Pulled out of the session because this is
// where the subtle case lives: a read can end in the middle of a frame, and parsing the halves
// independently would print the sentinel to the panel and then wait forever for one that already
// went past.
//
// A payload that does not look like a sentinel is put back as text, so a command that happens to
// print a zero-width space of its own cannot be mistaken for the shell answering.
function createFrameSplitter({ onText, onFrame }) {
  let pending = '';

  const write = (chunk) => {
    let buffer = pending + chunk;
    pending = '';
    for (;;) {
      const open = buffer.indexOf(FRAME);
      if (open < 0) { onText(buffer); return; }
      const close = buffer.indexOf(FRAME, open + 1);
      if (close < 0) {
        onText(buffer.slice(0, open));
        pending = buffer.slice(open);
        return;
      }
      const payload = buffer.slice(open + 1, close);
      onText(buffer.slice(0, open));
      if (/^p?\d+$/.test(payload)) onFrame(payload);
      else onText(FRAME + payload + FRAME);
      buffer = buffer.slice(close + 1);
    }
  };

  return { write };
}

function createShell({
  command = 'bash',
  args = ['--norc', '--noprofile', '-s'],
  cwd = process.cwd(),
  env = {},
  onOutput = () => {},
  // Applied to everything that leaves this module — what is drawn, what waitFor matches, and
  // what an error message quotes. One place, so the panel and the runbook cannot disagree about
  // what was redacted.
  scrub = (text) => text,
} = {}) {
  const child = spawn(command, args, {
    cwd,
    env: {
      ...process.env,
      // Colour for the tools that take the hint. The rest need --color=always in the step script;
      // without a terminal there is nothing for them to detect.
      CLICOLOR_FORCE: '1',
      FORCE_COLOR: '1',
      TERM: 'xterm-256color',
      // A recording must not leave anything behind in the operator's shell history.
      HISTFILE: '/dev/null',
      ...env,
    },
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  let accumulated = '';           // everything drawn so far, for waitFor and for error messages
  let closed = false;
  let exitInfo = null;

  const frameWaiters = [];        // resolved by the next sentinel
  const patternWaiters = [];      // resolved when the output matches

  const emit = (raw) => {
    if (!raw) return;
    const text = scrub(raw);
    accumulated += text;
    onOutput(text);
    for (const waiter of [...patternWaiters]) {
      const match = accumulated.match(waiter.pattern);
      if (!match) continue;
      patternWaiters.splice(patternWaiters.indexOf(waiter), 1);
      clearTimeout(waiter.timer);
      waiter.resolve(match);
    }
  };

  const deliverFrame = (payload) => {
    const waiter = frameWaiters.shift();
    if (waiter) {
      clearTimeout(waiter.timer);
      waiter.resolve(payload);
    }
  };

  const splitter = createFrameSplitter({ onText: emit, onFrame: deliverFrame });
  const consume = splitter.write;

  child.stdout.on('data', (d) => consume(String(d)));
  child.stderr.on('data', (d) => consume(String(d)));

  const rejectAll = (error) => {
    for (const waiter of frameWaiters.splice(0)) { clearTimeout(waiter.timer); waiter.reject(error); }
    for (const waiter of patternWaiters.splice(0)) { clearTimeout(waiter.timer); waiter.reject(error); }
  };

  child.on('exit', (code, signal) => {
    closed = true;
    exitInfo = { code, signal };
    // Whatever was still waiting can never arrive now. Failing here, with the output that led up
    // to it, is the difference between a readable error and a step that sits until it times out.
    rejectAll(timeoutError(
      `The shell exited (${signal ? `signal ${signal}` : `code ${code}`}) while a command was still running.`,
      accumulated
    ));
  });

  const send = (line) => {
    if (closed) throw new Error('The shell session is already closed');
    child.stdin.write(`${line}\n`);
  };

  // Every wait is bounded. An unbounded one turns a broken step script into a recording session
  // that never ends and never says why.
  const waitForFrame = (what, timeout) => new Promise((resolve, reject) => {
    const waiter = { resolve, reject };
    waiter.timer = setTimeout(() => {
      const index = frameWaiters.indexOf(waiter);
      if (index >= 0) frameWaiters.splice(index, 1);
      reject(timeoutError(`${what} did not finish within ${timeout}ms.`, accumulated));
    }, timeout);
    frameWaiters.push(waiter);
  });

  async function run(cmd, { timeout = DEFAULT_TIMEOUT_MS } = {}) {
    const from = accumulated.length;
    send(cmd);
    send(`printf '${FRAME}%s${FRAME}' "$?"`);
    const payload = await waitForFrame(`\`${cmd}\``, timeout);
    return { exitCode: Number(payload), output: accumulated.slice(from) };
  }

  // Backgrounded, and the shell answers with the process id. Without a pty there is no job
  // control and no ^C to send, so the id is the only handle on a command that never exits —
  // interrupt() turns it back into an ordinary `kill`.
  async function start(cmd, { timeout = DEFAULT_TIMEOUT_MS } = {}) {
    // `disown` drops the job from the shell's table. Without it, bash announces the job the
    // moment it changes state — "[1]+  Interrupt: 2  tail -f …" appears in the panel and tells
    // the viewer the command was running in the background, which is an implementation detail
    // of this runner and not something that happened in the app. The process group survives
    // being disowned, so interrupt() still reaches it.
    send(`${cmd} & __ev_pid=$!; disown`);
    send(`printf '${FRAME}p%s${FRAME}' "$__ev_pid"`);
    const payload = await waitForFrame(`starting \`${cmd}\``, timeout);
    return { pid: Number(payload.slice(1)) };
  }

  function waitFor(pattern, { timeout = DEFAULT_TIMEOUT_MS } = {}) {
    const regexp = pattern instanceof RegExp
      ? pattern
      : new RegExp(String(pattern).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

    const already = accumulated.match(regexp);
    if (already) return Promise.resolve(already);

    return new Promise((resolve, reject) => {
      const waiter = { pattern: regexp, resolve, reject };
      waiter.timer = setTimeout(() => {
        const index = patternWaiters.indexOf(waiter);
        if (index >= 0) patternWaiters.splice(index, 1);
        reject(timeoutError(`Nothing matched ${regexp} within ${timeout}ms.`, accumulated));
      }, timeout);
      patternWaiters.push(waiter);
    });
  }

  // Stopping a command that never ends, the way a terminal does when someone presses ^C.
  //
  // The negative pid signals the whole process group: `while …; do …; sleep 1; done` is a shell
  // plus whatever it is running right now, and signalling only the first leaves the second
  // behind. `set -m` below is what gives the job a group of its own to signal.
  //
  // What it deliberately does NOT do is `wait`. A job that ignores the signal, or dies at the
  // wrong moment, leaves `wait` blocking until the step's timeout — a take that stops for thirty
  // seconds and then fails, with the reason nowhere on screen. Instead the group is polled, and
  // the signal escalates on its own. The whole sequence is bounded at about three seconds, and
  // it never leaves a process running on the operator's machine after the take.
  const KILL_ESCALATION = (pid) => [
    `kill -INT -${pid} 2>/dev/null`,
    `i=0; while kill -0 -${pid} 2>/dev/null && [ $i -lt 20 ]; do sleep 0.1; i=$((i+1)); done`,
    `kill -TERM -${pid} 2>/dev/null`,
    `i=0; while kill -0 -${pid} 2>/dev/null && [ $i -lt 10 ]; do sleep 0.1; i=$((i+1)); done`,
    `kill -KILL -${pid} 2>/dev/null`,
    'true',
  ].join('; ');

  const interrupt = (pid, { timeout = 10000 } = {}) => run(KILL_ESCALATION(pid), { timeout });

  // Job control gives every command a process group of its own, which is what makes interrupt()
  // work — and what stops a single kill from cleaning up. Killing the shell leaves whatever it
  // was running reparented to init, still holding the pipe: the take ends, node will not exit,
  // and there is a stray process on the operator's machine.
  //
  // Each direct child is a group leader, so signalling its group takes its own children with it.
  // This is the forced path only; a session that closes normally never reaches it.
  function killDescendants(pid) {
    let children = [];
    try {
      children = execFileSync('pgrep', ['-P', String(pid)], { encoding: 'utf8' })
        .split('\n').map((line) => Number(line.trim())).filter(Boolean);
    } catch {
      return; // pgrep exits non-zero when there are no children, which is the common case
    }
    for (const child of children) {
      try { process.kill(-child, 'SIGKILL'); } catch { /* already gone */ }
    }
  }

  function close({ timeout = 5000 } = {}) {
    if (closed) return Promise.resolve(exitInfo);
    return new Promise((resolve) => {
      const force = setTimeout(() => {
        killDescendants(child.pid);
        child.kill('SIGKILL');
        // The pipes can outlive the process they belonged to, and an open pipe keeps node running
        child.stdout.destroy();
        child.stderr.destroy();
      }, timeout);
      child.on('exit', () => { clearTimeout(force); resolve(exitInfo); });
      // Anything still running in the background would otherwise outlive the take
      try {
        child.stdin.write('for __job in $(jobs -p); do kill -KILL -$__job 2>/dev/null; done\n');
        child.stdin.end('exit\n');
      } catch {
        killDescendants(child.pid);
        child.kill('SIGKILL');
      }
    });
  }

  // Two settings open every session:
  //
  //   exec 2>&1  folds stderr into stdout, so the two arrive interleaved in the order they were
  //              written. Two separate pipes cannot promise that, and in a video the wrong order
  //              reads as the app doing things in the wrong order.
  //   set -m     turns on job control, which puts each backgrounded command in a process group
  //              of its own. Without it a background job inherits an ignored SIGINT — the POSIX
  //              rule for an asynchronous list — and interrupt() would have nothing to signal.
  //
  // Neither produces output, but the sentinel that follows them does, so the accumulated text is
  // cleared afterwards: the panel opens on an empty screen, not on the session's own plumbing.
  const ready = run('exec 2>&1; set -m', { timeout: DEFAULT_TIMEOUT_MS }).then(() => {
    accumulated = '';
    return undefined;
  });

  return {
    ready,
    run,
    start,
    waitFor,
    interrupt,
    close,
    send,
    output: () => accumulated,
    get closed() { return closed; },
  };
}

module.exports = { createShell, createFrameSplitter, FRAME, DEFAULT_TIMEOUT_MS };
