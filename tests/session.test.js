// Everything the runner does before a browser exists: refusing to write into the skill
// directory, finding the project config from the nearest place outward, remembering an
// account, and resolving which app a script talks to.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const PROJECT = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'evidence-session-')));
process.env.PROJECT_ROOT = PROJECT;

const {
  ROOT, SKILL_DIR, assertOutsideSkill, loadProjectConfig,
  makeAccountStore, generatePassword, resolveApp,
} = require('../src/skills/get-evidence/scripts/session');

// The lookup walks up from the script directory, so each case needs its own tree to walk.
function tree(files) {
  const base = fs.mkdtempSync(path.join(PROJECT, 'case-'));
  for (const [rel, body] of Object.entries(files)) {
    const file = path.join(base, rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, body);
  }
  return base;
}

const configFile = (marker) => `module.exports = { marker: '${marker}', defaultApp: 'admin', apps: { admin: { baseUrl: 'http://localhost:3000' } } };\n`;

function withEnv(vars, fn) {
  const saved = { EVIDENCE_CONFIG: process.env.EVIDENCE_CONFIG, BASE_URL: process.env.BASE_URL };
  Object.entries(vars).forEach(([k, v]) => { if (v === undefined) delete process.env[k]; else process.env[k] = v; });
  try {
    return fn();
  } finally {
    Object.entries(saved).forEach(([k, v]) => { if (v === undefined) delete process.env[k]; else process.env[k] = v; });
  }
}

const load = (startDir, env = {}) => withEnv({ EVIDENCE_CONFIG: undefined, ...env }, () => loadProjectConfig(startDir));

test('the project root is taken from PROJECT_ROOT and is not the skill directory', () => {
  assert.equal(ROOT, PROJECT);
  assert.notEqual(ROOT, SKILL_DIR);
});

test('writing into the skill directory is refused: it is shared by every project', () => {
  assert.throws(() => assertOutsideSkill(SKILL_DIR, 'OUT_DIR'), /OUT_DIR/);
  assert.throws(() => assertOutsideSkill(path.join(SKILL_DIR, 'scripts', 'scratch.js'), 'Steps file'));
});

test('a path inside the project is accepted and returned absolute', () => {
  assert.equal(assertOutsideSkill(path.join(PROJECT, 'evidence'), 'OUT_DIR'), path.join(PROJECT, 'evidence'));
});

test('a config sitting next to the script wins over the shared one further up', () => {
  const base = tree({
    'evidence/evidence.config.js': configFile('shared'),
    'backlogs/1599/evidence.config.js': configFile('issue'),
  });
  const { file, config } = load(path.join(base, 'backlogs/1599'));
  assert.equal(config.marker, 'issue');
  assert.equal(file, path.join(base, 'backlogs/1599/evidence.config.js'));
});

test('with no local config, the walk upwards finds the shared one', () => {
  const base = tree({
    'evidence/evidence.config.js': configFile('shared-up'),
    'backlogs/1599/notes.md': 'notes',
  });
  assert.equal(load(path.join(base, 'backlogs/1599')).config.marker, 'shared-up');
});

test('an evidence/ subdirectory counts as a config location at every level', () => {
  const base = tree({ 'apps/admin/evidence/evidence.config.js': configFile('scoped') });
  assert.equal(load(path.join(base, 'apps/admin')).config.marker, 'scoped');
});

test('EVIDENCE_CONFIG overrides the search entirely', () => {
  const base = tree({
    'evidence/evidence.config.js': configFile('nearby'),
    'elsewhere/custom.config.js': configFile('explicit'),
  });
  const chosen = path.join(base, 'elsewhere/custom.config.js');
  const { config } = load(base, { EVIDENCE_CONFIG: chosen });
  assert.equal(config.marker, 'explicit');
});

test('an EVIDENCE_CONFIG path that does not exist is reported, not ignored', () => {
  assert.throws(() => load(PROJECT, { EVIDENCE_CONFIG: path.join(PROJECT, 'missing.config.js') }), /missing\.config\.js/);
});

test('with no config anywhere, the error points at the example to copy', () => {
  const base = tree({ 'notes.md': 'no config here' });
  assert.throws(() => load(base), /evidence\.config\.js/);
});

test('an account is remembered between runs, and an unknown app reads back as null', () => {
  const store = makeAccountStore(path.join(PROJECT, 'accounts.json'));
  assert.equal(store.get('admin'), null);

  store.set('admin', { email: 'dev@example.com', password: 'secret' });
  assert.deepEqual(makeAccountStore(store.path).get('admin'), { email: 'dev@example.com', password: 'secret' });
  assert.equal(store.get('other'), null);
});

test('a second app is added without dropping the first', () => {
  const store = makeAccountStore(path.join(PROJECT, 'multi-accounts.json'));
  store.set('admin', { email: 'admin@example.com' });
  store.set('portal', { email: 'portal@example.com' });
  assert.equal(store.get('admin').email, 'admin@example.com');
  assert.equal(store.get('portal').email, 'portal@example.com');
});

test('the account file holds passwords, so it is written owner-only', () => {
  const store = makeAccountStore(path.join(PROJECT, 'perm-accounts.json'));
  store.set('admin', { email: 'dev@example.com', password: 'secret' });
  assert.equal(fs.statSync(store.path).mode & 0o777, 0o600);
});

test('a relative account store path is resolved against the project, never the skill', () => {
  const store = makeAccountStore('.evidence/accounts.json');
  assert.equal(store.path, path.join(PROJECT, '.evidence/accounts.json'));
});

test('a damaged account file degrades to "no account" instead of crashing the run', () => {
  const file = path.join(PROJECT, 'broken-accounts.json');
  fs.writeFileSync(file, '{ not json');
  assert.equal(makeAccountStore(file).get('admin'), null);
});

test('generated passwords are unique and mixed enough for a strength validator', () => {
  const seen = new Set();
  for (let i = 0; i < 50; i++) {
    const password = generatePassword();
    assert.ok(password.length >= 12, password);
    assert.match(password, /[a-z]/);
    assert.match(password, /[A-Z]/);
    assert.match(password, /[0-9]/);
    assert.match(password, /[^A-Za-z0-9]/);
    seen.add(password);
  }
  assert.equal(seen.size, 50);
});

test('a script without an app falls back to defaultApp', () => {
  const config = { defaultApp: 'admin', apps: { admin: { baseUrl: 'http://localhost:3000' } } };
  const resolved = withEnv({ BASE_URL: undefined }, () => resolveApp(config, undefined));
  assert.equal(resolved.name, 'admin');
  assert.equal(resolved.baseUrl, 'http://localhost:3000');
});

test('BASE_URL overrides the configured URL for one run', () => {
  const config = { defaultApp: 'admin', apps: { admin: { baseUrl: 'http://localhost:3000' } } };
  const resolved = withEnv({ BASE_URL: 'http://localhost:4000' }, () => resolveApp(config, 'admin'));
  assert.equal(resolved.baseUrl, 'http://localhost:4000');
});

test('an app the config never declared is named in the error', () => {
  assert.throws(() => resolveApp({ defaultApp: 'admin', apps: {} }, 'portal'), /portal/);
});

test.after(() => fs.rmSync(PROJECT, { recursive: true, force: true }));
