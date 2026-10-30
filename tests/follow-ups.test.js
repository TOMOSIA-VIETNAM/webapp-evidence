// After a take is handed over, the runner tells the agent what it may offer the user, each at most
// once per machine: the feedback command after the first take, and starring the repository when
// the GitHub account has not. Offered every time, either one turns into noise the user learns to
// skip; offered after a failure, the star is asked at the worst moment.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { startFollowUps, REPO } = require('../src/skills/recording/scripts/follow-ups');

const scratch = [];
function freshMachine() {
  process.env.XDG_CONFIG_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'evidence-follow-ups-'));
  scratch.push(process.env.XDG_CONFIG_HOME);
}
test.after(() => scratch.forEach((dir) => fs.rmSync(dir, { recursive: true, force: true })));

const answer = (status) => {
  let calls = 0;
  const check = async () => { calls += 1; return status; };
  return { check, calls: () => calls };
};

test('the first take is marked as such, and only the first', async () => {
  freshMachine();
  const quiet = answer('starred').check;
  assert.ok((await startFollowUps({ check: quiet })()).some((l) => l.startsWith('FIRST TAKE:')));
  assert.ok(!(await startFollowUps({ check: quiet })()).some((l) => l.startsWith('FIRST TAKE:')));
});

test('an account that has not starred is offered the star once, naming the repository', async () => {
  freshMachine();
  const star = answer('not-starred');
  const first = await startFollowUps({ check: star.check })();
  assert.ok(first.some((l) => l.startsWith('STAR:') && l.includes(REPO)), first.join('\n'));
  const second = await startFollowUps({ check: star.check })();
  assert.ok(!second.some((l) => l.startsWith('STAR:')));
  assert.equal(star.calls(), 1, 'checked again after it was offered');
});

test('an account that already starred is never offered it, nor checked again', async () => {
  freshMachine();
  const star = answer('starred');
  assert.ok(!(await startFollowUps({ check: star.check })()).some((l) => l.startsWith('STAR:')));
  await startFollowUps({ check: star.check })();
  assert.equal(star.calls(), 1);
});

test('when gh cannot tell, nothing is offered and the next take tries again', async () => {
  freshMachine();
  const unknown = answer(null);
  assert.ok(!(await startFollowUps({ check: unknown.check })()).some((l) => l.startsWith('STAR:')));
  const failing = { check: async () => { throw new Error('gh: command not found'); } };
  assert.ok(!(await startFollowUps(failing)()).some((l) => l.startsWith('STAR:')));
  await startFollowUps({ check: unknown.check })();
  assert.equal(unknown.calls(), 2);
});

test('a take that fails before it is handed over does not use the star up', async () => {
  freshMachine();
  const star = answer('not-starred');
  startFollowUps({ check: star.check });   // never finished: the take threw
  const next = await startFollowUps({ check: star.check })();
  assert.ok(next.some((l) => l.startsWith('STAR:')));
});

test('STAR_CHECK=0 keeps the runner from asking GitHub at all', async (t) => {
  freshMachine();
  process.env.STAR_CHECK = '0';
  t.after(() => delete process.env.STAR_CHECK);
  const star = answer('not-starred');
  assert.ok(!(await startFollowUps({ check: star.check })()).some((l) => l.startsWith('STAR:')));
  assert.equal(star.calls(), 0);
});

test('the repository offered is the one the plugin manifest names', () => {
  const manifest = require('../src/.claude-plugin/plugin.json');
  assert.equal(`https://github.com/${REPO}`, manifest.repository);
});
