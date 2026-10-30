// The runner is held to the playwright-core version its package.json pins. Without an install next
// to the scripts, Node resolves another tool's copy through NODE_PATH, and a different version
// records without an error but leaves a gray band along the bottom of every video. So a missing or
// mismatched install stops the run instead, saying which version was found and where it belongs.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const SCRIPTS = path.join(__dirname, '..', 'src', 'skills', 'recording', 'scripts');
const PINNED = require(path.join(SCRIPTS, 'package.json')).dependencies['playwright-core'];

// A copy of the module with its package.json, and optionally a stand-in playwright-core: a fresh
// process requiring it resolves only what is in that scratch directory (and NODE_PATH, if given).
function load({ installed = null, nodePath = null } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'evidence-playwright-'));
  fs.copyFileSync(path.join(SCRIPTS, 'playwright.js'), path.join(dir, 'playwright.js'));
  fs.copyFileSync(path.join(SCRIPTS, 'package.json'), path.join(dir, 'package.json'));
  if (installed) fakePackage(path.join(dir, 'node_modules'), installed);
  return spawnSync(process.execPath, ['-e', `require(${JSON.stringify(path.join(dir, 'playwright.js'))}); console.log('loaded')`], {
    encoding: 'utf8',
    env: { ...process.env, NODE_PATH: nodePath ?? '' },
  });
}

function fakePackage(nodeModules, version) {
  const pkg = path.join(nodeModules, 'playwright-core');
  fs.mkdirSync(pkg, { recursive: true });
  fs.writeFileSync(path.join(pkg, 'package.json'), JSON.stringify({ name: 'playwright-core', version, main: 'index.js' }));
  fs.writeFileSync(path.join(pkg, 'index.js'), 'module.exports = { chromium: {} };');
  return nodeModules;
}

test('the pinned version loads', () => {
  const run = load({ installed: PINNED });
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /loaded/);
});

test('another tool\'s copy on NODE_PATH is refused, naming both versions and where it came from', () => {
  const elsewhere = fakePackage(fs.mkdtempSync(path.join(os.tmpdir(), 'evidence-other-tool-')), '1.0.0');
  const run = load({ nodePath: elsewhere });
  assert.notEqual(run.status, 0);
  assert.doesNotMatch(run.stdout, /loaded/);
  assert.match(run.stderr, /1\.0\.0/);
  assert.match(run.stderr, new RegExp(PINNED.replace(/\./g, '\\.')));
  assert.ok(run.stderr.includes(elsewhere), run.stderr);
});

test('a missing install is refused rather than left to a bare module-not-found', () => {
  const run = load();
  assert.notEqual(run.status, 0);
  assert.doesNotMatch(run.stderr, /Cannot find module/);
  assert.match(run.stderr, new RegExp(PINNED.replace(/\./g, '\\.')));
});
