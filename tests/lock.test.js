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

const { acquire, fileFor, isRunning } = require('../src/skills/recording/scripts/lock');

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
