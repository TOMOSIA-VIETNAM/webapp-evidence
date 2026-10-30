// One take at a time per project. Two runs against the same project share the application's build
// cache and its development server's state, and what that does to the take that loses the race —
// a blank page, a 404 from a route the application defines — points at everything except the other
// run. So the refusal has to name it, and a lock left behind by a run that is gone has to be taken
// over rather than obeyed: a crash would otherwise lock the project until someone found the file.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { acquire, update, fileFor, isRunning, processStart } = require('../src/skills/recording/scripts/lock');

const project = () => fs.mkdtempSync(path.join(os.tmpdir(), 'evidence-lock-'));

test('a second take on the same project is refused, and told which run holds it', () => {
  const root = project();
  const release = acquire(root, { outDir: '/tmp/evidence-out' });
  try {
    assert.throws(() => acquire(root, { pid: process.pid + 1 }), (error) => {
      assert.match(error.message, new RegExp(String(process.pid)));
      assert.match(error.message, /evidence-out/);
      return true;
    });
  } finally {
    release();
  }
});

test('the lock is released, so the next take goes ahead', () => {
  const root = project();
  acquire(root)();
  const second = acquire(root);
  assert.equal(fs.existsSync(fileFor(root)), true);
  second();
  assert.equal(fs.existsSync(fileFor(root)), false);
});

test('a lock left behind by a run that is gone is taken over', () => {
  const root = project();
  fs.mkdirSync(path.dirname(fileFor(root)), { recursive: true });
  // A pid that cannot be running: process 0 is not a process any platform hands out.
  fs.writeFileSync(fileFor(root), JSON.stringify({ pid: 0, startedAt: Date.now() }));

  const release = acquire(root);
  assert.equal(JSON.parse(fs.readFileSync(fileFor(root), 'utf8')).pid, process.pid);
  release();
});

test('a lock file nothing can be read out of does not stop a take', () => {
  const root = project();
  fs.mkdirSync(path.dirname(fileFor(root)), { recursive: true });
  fs.writeFileSync(fileFor(root), 'half a write and then the machine went down');
  const release = acquire(root);
  release();
  assert.equal(fs.existsSync(fileFor(root)), false);
});

test('two projects are locked separately', () => {
  const one = project();
  const other = project();
  const release = acquire(one);
  const second = acquire(other, { pid: process.pid + 1 });
  release();
  second();
});

test('releasing does not remove a lock another run has since taken', () => {
  const root = project();
  const release = acquire(root);
  fs.writeFileSync(fileFor(root), JSON.stringify({ pid: process.pid + 1, startedAt: Date.now() }));
  release();
  assert.equal(fs.existsSync(fileFor(root)), true, 'the other run\'s lock was removed');
  fs.unlinkSync(fileFor(root));
});

test('this process counts as running, and one that never existed does not', () => {
  assert.equal(isRunning(process.pid), true);
  assert.equal(isRunning(0), false);
  assert.equal(isRunning(-1), false);
});

test('a probe holding the lock is not reported as a take that is recording', () => {
  // `inspect.js` takes the same lock as a recording, so the refusal a take gets has to name what is
  // really there — otherwise it sends the reader looking for a take that does not exist.
  const root = project();
  const release = acquire(root, { kind: 'probe' });
  try {
    assert.throws(() => acquire(root, { pid: process.pid + 1 }), (error) => {
      assert.match(error.message, /prob/i);
      assert.doesNotMatch(error.message, /take is already recording/);
      return true;
    });
  } finally {
    release();
  }
});

test('a take holding the lock is named as one', () => {
  const root = project();
  const release = acquire(root);
  try {
    assert.throws(() => acquire(root, { pid: process.pid + 1 }), /take/);
  } finally {
    release();
  }
});

test('the holder adds its state to the lock, and nobody else can', () => {
  const root = project();
  const release = acquire(root, { outDir: '/tmp/evidence-out' });
  try {
    update(root, { screen: 'waiting', secondsLeft: 2 });
    const held = JSON.parse(fs.readFileSync(fileFor(root), 'utf8'));
    assert.equal(held.screen, 'waiting');
    assert.equal(held.secondsLeft, 2);
    assert.equal(held.pid, process.pid);
    assert.equal(held.outDir, '/tmp/evidence-out');

    update(root, { screen: 'recording' }, process.pid + 1);
    assert.equal(JSON.parse(fs.readFileSync(fileFor(root), 'utf8')).screen, 'waiting');
    assert.deepEqual(fs.readdirSync(path.dirname(fileFor(root))).filter((f) => f.endsWith('.tmp')), []);
  } finally {
    release();
  }
  // Released, there is nothing to add to and nothing is created
  update(root, { screen: 'recording' });
  assert.equal(fs.existsSync(fileFor(root)), false);
});

// A take killed outright runs no handler, and the Chrome it launched outlives it. Left running
// beside the next take's, two of them hung the GPU of an Intel Mac and restarted it. The next run
// that takes any lock ends that browser — and only a browser: a reused pid is left alone.
const { spawn, spawnSync } = require('node:child_process');

const deadPid = () => spawnSync(process.execPath, ['-e', '']).pid;

// Its own process group, as Playwright starts Chrome
function fakeBrowser() {
  const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], {
    detached: true, stdio: 'ignore',
  });
  child.unref();
  return child;
}

const exited = (child) => new Promise((resolve) => {
  if (child.exitCode !== null || child.signalCode !== null) resolve(true);
  child.once('exit', () => resolve(true));
  setTimeout(() => resolve(false), 3000);
});

function leaveLock(root, browserPid, browserStarted = processStart(browserPid)) {
  fs.mkdirSync(path.dirname(fileFor(root)), { recursive: true });
  fs.writeFileSync(fileFor(root), JSON.stringify({ pid: deadPid(), browserPid, browserStarted, kind: 'take' }));
}

const endGroup = (child) => { try { process.kill(-child.pid, 'SIGKILL'); } catch { /* already ended */ } };

test('the browser of a run that was killed outright is ended by the next take, in any project', async () => {
  const browser = fakeBrowser();
  leaveLock(project(), browser.pid);
  const release = acquire(project());   // another project entirely
  try {
    assert.ok(await exited(browser), 'the left-behind browser is still running');
  } finally {
    release();
    endGroup(browser);
  }
});

test('a process that has taken over the browser\'s pid since — after a restart — is left running', async () => {
  const other = fakeBrowser();
  const root = project();
  leaveLock(root, other.pid, 'Thu Jan  1 00:00:00 1970');
  const release = acquire(root);
  try {
    assert.equal(await Promise.race([exited(other), new Promise((r) => setTimeout(() => r(false), 500))]), false);
    assert.ok(isRunning(other.pid));
  } finally {
    release();
    endGroup(other);
  }
});
