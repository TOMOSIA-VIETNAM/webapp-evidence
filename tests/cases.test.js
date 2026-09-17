// A case is two files in a directory, and the runner finds it by looking. Everything that can go
// wrong with that goes wrong silently — a directory with no CASE.md is a case the agent never
// reads, a helper name claimed twice is whichever directory was read last — so each one is made
// to stop the run instead, and this is where that is checked.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { loadCases, applyCases } = require('../src/skills/recording/scripts/cases');

const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'evidence-cases-'));
test.after(() => fs.rmSync(ROOT, { recursive: true, force: true }));

// Each fixture gets a directory of its own, so one malformed case cannot decide what another test
// sees, and so `require` is never handed a path it has already cached.
let made = 0;
function casesDir(cases) {
  made += 1;
  const dir = path.join(ROOT, `set-${made}`);
  for (const [name, files] of Object.entries(cases)) {
    const here = path.join(dir, name);
    fs.mkdirSync(here, { recursive: true });
    for (const [file, body] of Object.entries(files)) fs.writeFileSync(path.join(here, file), body);
  }
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

const wellFormed = (name, helper = 'thing') => ({
  'CASE.md': `# ${name}\n`,
  'index.js': `module.exports = {\n`
    + `  name: '${name}',\n`
    + `  helpers: (runtime) => ({ ${helper}: { root: runtime.root } }),\n`
    + '};\n',
});

test('a well-formed case is loaded, and its helpers reach the step scope', () => {
  const dir = casesDir({ api: wellFormed('api', 'api') });
  const cases = loadCases(dir);
  assert.deepEqual(cases.map((one) => one.name), ['api']);

  const helpers = applyCases(cases, { root: '/project' });
  assert.deepEqual(Object.keys(helpers), ['api']);
  assert.equal(helpers.api.root, '/project');
});

test('a case with no index.js stops the run, naming the directory', () => {
  const dir = casesDir({ api: { 'CASE.md': '# api\n' } });
  assert.throws(() => loadCases(dir), (error) => {
    assert.match(error.message, /index\.js/);
    assert.match(error.message, /api/);
    return true;
  });
});

test('a case with no CASE.md stops the run too: the agent would never know it is there', () => {
  const dir = casesDir({ api: { 'index.js': 'module.exports = { name: "api", helpers: () => ({}) };' } });
  assert.throws(() => loadCases(dir), /CASE\.md/);
});

test('a case whose name is not its directory is refused rather than answering to two names', () => {
  const dir = casesDir({ api: wellFormed('endpoints') });
  assert.throws(() => loadCases(dir), (error) => {
    assert.match(error.message, /endpoints/);
    assert.match(error.message, /api/);
    return true;
  });
});

test('a case that adds nothing a step script can call is refused', () => {
  const dir = casesDir({ api: { 'CASE.md': '#\n', 'index.js': 'module.exports = { name: "api" };' } });
  assert.throws(() => loadCases(dir), /helpers/);
});

test('two cases claiming one helper name stop the run instead of one of them winning', () => {
  const dir = casesDir({ api: wellFormed('api', 'call'), rpc: wellFormed('rpc', 'call') });
  assert.throws(() => applyCases(loadCases(dir), { root: '/project' }), (error) => {
    assert.match(error.message, /call/);
    assert.match(error.message, /api/);
    assert.match(error.message, /rpc/);
    return true;
  });
});

test('a directory with no cases in it is not an error: nothing is added to the scope', () => {
  assert.deepEqual(applyCases(loadCases(casesDir({})), {}), {});
});

test('every case the skill ships loads as it stands', () => {
  // The fixtures above prove the rules; this proves the directory a recording actually reads
  // still passes them, which is what a new case gets wrong on the day it is added.
  const shipped = loadCases(path.resolve(__dirname, '../src/skills/recording/cases'));
  assert.ok(shipped.length > 0, 'the skill ships no cases at all');
});
