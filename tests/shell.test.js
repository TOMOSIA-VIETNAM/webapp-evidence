const test = require('node:test');
const assert = require('node:assert');
const os = require('node:os');
const fs = require('node:fs');
const path = require('node:path');
const { createShell, createFrameSplitter, FRAME } = require('../src/skills/recording/scripts/shell.js');

// ---------- the frame splitter: pure, and where the subtle cases are ----------

function collect(chunks) {
  const text = [];
  const frames = [];
  const splitter = createFrameSplitter({ onText: (t) => t && text.push(t), onFrame: (f) => frames.push(f) });
  chunks.forEach((c) => splitter.write(c));
  return { text: text.join(''), frames };
}

test('a sentinel is taken out of the text and reported on its own', () => {
  const { text, frames } = collect([`hello\n${FRAME}0${FRAME}`]);
  assert.strictEqual(text, 'hello\n');
  assert.deepStrictEqual(frames, ['0']);
});

test('a sentinel split across two reads is reassembled', () => {
  const whole = collect([`out${FRAME}127${FRAME}rest`]);
  const split = collect(['out', FRAME, '12', `7${FRAME}re`, 'st']);
  assert.deepStrictEqual(split, whole);
  assert.strictEqual(split.text, 'outrest');
  assert.deepStrictEqual(split.frames, ['127']);
});

test('several sentinels in one read are all reported, in order', () => {
  const { frames } = collect([`a${FRAME}0${FRAME}b${FRAME}p42${FRAME}c`]);
  assert.deepStrictEqual(frames, ['0', 'p42']);
});

test('a zero-width space in the command output is text, not a sentinel', () => {
  const { text, frames } = collect([`before${FRAME}not a code${FRAME}after`]);
  assert.strictEqual(frames.length, 0);
  assert.ok(text.includes('not a code'));
});

test('text arriving without any sentinel is passed straight through', () => {
  assert.strictEqual(collect(['plain output\n']).text, 'plain output\n');
});

// ---------- the session: a real bash, no browser needed ----------

const withShell = async (body) => {
  const shell = createShell();
  try {
    await shell.ready;
    await body(shell);
  } finally {
    await shell.close();
  }
};

test('a command reports its output and a zero exit code', async () => {
  await withShell(async (shell) => {
    const { exitCode, output } = await shell.run('echo hello');
    assert.strictEqual(exitCode, 0);
    assert.strictEqual(output, 'hello\n');
  });
});

test('a failing command reports its own exit code rather than throwing', async () => {
  await withShell(async (shell) => {
    assert.strictEqual((await shell.run('false')).exitCode, 1);
    assert.strictEqual((await shell.run('(exit 3)')).exitCode, 3);
    // …and the session survives a failure, so the next step still records something
    assert.strictEqual((await shell.run('echo alive')).output, 'alive\n');
  });
});

test('state carries from one command to the next', async () => {
  await withShell(async (shell) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'evidence-shell-'));
    await shell.run(`cd ${dir}`);
    await shell.run('MARKER=carried');
    const { output } = await shell.run('echo "$PWD $MARKER"');
    assert.ok(output.includes(dir));
    assert.ok(output.includes('carried'));
    fs.rmSync(dir, { recursive: true, force: true });
  });
});

test('standard error arrives in the same stream, in the order it was written', async () => {
  await withShell(async (shell) => {
    const { output } = await shell.run('echo first; echo second >&2; echo third');
    assert.deepStrictEqual(output.trim().split('\n'), ['first', 'second', 'third']);
  });
});

test('waitFor resolves on output that has already arrived', async () => {
  await withShell(async (shell) => {
    await shell.run('echo needle');
    const match = await shell.waitFor(/needle/, { timeout: 1000 });
    assert.strictEqual(match[0], 'needle');
  });
});

test('waitFor resolves on output that arrives later', async () => {
  await withShell(async (shell) => {
    const { pid } = await shell.start('sleep 0.2; echo late-arrival');
    const match = await shell.waitFor('late-arrival', { timeout: 5000 });
    assert.strictEqual(match[0], 'late-arrival');
    await shell.interrupt(pid);
  });
});

test('a plain string is matched literally, not as a pattern', async () => {
  await withShell(async (shell) => {
    await shell.run('echo "a.c"');
    await shell.waitFor('a.c', { timeout: 1000 });
    await assert.rejects(shell.waitFor('abc', { timeout: 300 }));
  });
});

test('a waitFor that times out says what the shell had printed', async () => {
  await withShell(async (shell) => {
    await shell.run('echo groundwork');
    await assert.rejects(
      shell.waitFor(/never-appears/, { timeout: 400 }),
      (e) => e.message.includes('groundwork')
    );
  });
});

test('a command that never ends is started, interrupted, and leaves the session usable', async () => {
  await withShell(async (shell) => {
    const { pid } = await shell.start('while true; do echo tick; sleep 0.1; done');
    assert.ok(Number.isInteger(pid) && pid > 0);
    await shell.waitFor(/tick/, { timeout: 5000 });

    await shell.interrupt(pid);
    const settled = shell.output().length;
    await new Promise((r) => setTimeout(r, 400));
    assert.strictEqual(shell.output().length, settled, 'the interrupted command is still producing output');

    const { exitCode } = await shell.run('echo still-here');
    assert.strictEqual(exitCode, 0);
  });
});

test('interrupting reaches the whole job, not only the process the shell forked', async () => {
  await withShell(async (shell) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'evidence-shell-'));
    const witness = path.join(dir, 'witness');
    const { pid } = await shell.start(
      `while true; do sleep 0.1; echo x >> ${witness}; done`
    );
    await new Promise((r) => setTimeout(r, 300));
    await shell.interrupt(pid);
    await new Promise((r) => setTimeout(r, 300));
    const before = fs.readFileSync(witness, 'utf8').length;
    await new Promise((r) => setTimeout(r, 400));
    assert.strictEqual(fs.readFileSync(witness, 'utf8').length, before);
    fs.rmSync(dir, { recursive: true, force: true });
  });
});

test('the shell does not announce the job it was asked to start', async () => {
  await withShell(async (shell) => {
    const { pid } = await shell.start('while true; do echo tick; sleep 0.1; done');
    await shell.waitFor(/tick/, { timeout: 5000 });
    await shell.interrupt(pid);
    // "[1]+ Interrupt: 2 …" would tell a viewer the command was put in the background, which is
    // how this runner keeps the session usable — not something that happened in the application.
    assert.doesNotMatch(shell.output(), /^\[\d+\][+-]?\s/m);
  });
});

test('a command still running when the shell dies fails instead of hanging', async () => {
  const shell = createShell();
  await shell.ready;
  const pending = shell.run('sleep 30', { timeout: 20000 });
  setTimeout(() => shell.close({ timeout: 0 }), 200);
  await assert.rejects(pending, (e) => /exited/.test(e.message));
});

test('sending to a closed session is refused rather than silently dropped', async () => {
  const shell = createShell();
  await shell.ready;
  await shell.close();
  assert.throws(() => shell.send('echo x'), /closed/);
});

test('closing does not leave the command it was running behind on the machine', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'evidence-shell-'));
  const witness = path.join(dir, 'witness');
  const shell = createShell();
  await shell.ready;

  // A foreground command the shell is blocked on, so `exit` cannot be read and the forced path
  // is the one under test
  shell.run(`while true; do sleep 0.1; echo x >> ${witness}; done`, { timeout: 20000 }).catch(() => {});
  await new Promise((r) => setTimeout(r, 400));
  await shell.close({ timeout: 100 });

  await new Promise((r) => setTimeout(r, 300));
  const settled = fs.readFileSync(witness, 'utf8').length;
  await new Promise((r) => setTimeout(r, 400));
  assert.strictEqual(fs.readFileSync(witness, 'utf8').length, settled, 'a stray process outlived the session');
  fs.rmSync(dir, { recursive: true, force: true });
});
