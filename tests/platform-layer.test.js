// Guards for the platform layer. The promise it makes is that the skill exists once, under
// src/skills/, and that every platform's manifest and the installer point at that one copy. None of
// this fails on the machine that edits it — it fails on a user's machine, on the platform nobody
// re-tested — so the cheap checks live here.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');
const SKILLS = path.join(REPO, 'src', 'skills');

const MANIFESTS = [
  '.claude-plugin/marketplace.json',
  '.agents/plugins/marketplace.json',
  '.codex-plugin/plugin.json',
  '.cursor-plugin/plugin.json',
  '.cursor-plugin/marketplace.json',
  'gemini-extension.json',
  'plugin.json',
];

const read = (rel) => fs.readFileSync(path.join(REPO, rel), 'utf8');
const readJson = (rel) => JSON.parse(read(rel));
const skillDirs = () => fs.readdirSync(SKILLS, { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => e.name);

// Three names, deliberately different. A plugin namespaces the skills inside it, so a plugin
// called get-evidence would make the command read /get-evidence:get-evidence.
const MARKETPLACE = 'webapp-evidence';   // the repository, which is what a user adds
const PLUGIN = 'evidence';               // the namespace Claude Code prefixes onto the skill
const SKILL = 'get-evidence';            // what the other four platforms invoke directly

test('every manifest names the plugin, and a catalog names the marketplace around it', () => {
  for (const rel of MANIFESTS) {
    const manifest = readJson(rel);
    if (manifest.plugins) {
      assert.equal(manifest.name, MARKETPLACE, rel);
      assert.equal(manifest.plugins[0].name, PLUGIN, rel);
    } else {
      assert.equal(manifest.name, PLUGIN, rel);
    }
  }
});

test('the plugin pins no version, so every commit reaches a client that auto-updates', () => {
  // A git source falls back to the commit SHA. A `version` here would freeze clients until it
  // is bumped, and forgetting to bump fails silently — nobody gets the update and nobody is told.
  for (const rel of ['src/.claude-plugin/plugin.json', '.codex-plugin/plugin.json', '.cursor-plugin/plugin.json', 'plugin.json']) {
    assert.equal(readJson(rel).version, undefined, `${rel} pins a version`);
  }
});

test('a manifest pointing at a skills directory points at one that exists', () => {
  for (const rel of MANIFESTS) {
    const declared = readJson(rel).skills;
    if (!declared) continue;
    const dir = path.resolve(REPO, declared);
    assert.ok(fs.existsSync(dir), `${rel} declares ${declared}, which does not exist`);
    assert.equal(dir, SKILLS, `${rel} points somewhere other than src/skills`);
  }
});

test("Claude Code's marketplace ships the plugin directory, not the whole repository", () => {
  const entry = readJson('.claude-plugin/marketplace.json').plugins[0];
  const source = path.resolve(REPO, entry.source);
  assert.equal(source, path.join(REPO, 'src'));
  // The manifest inside that directory is what Claude Code reads once it is copied.
  assert.ok(fs.existsSync(path.join(source, '.claude-plugin', 'plugin.json')));
});

test('the shipped skill is whole: SKILL.md plus what it tells the agent to read', () => {
  const dirs = skillDirs();
  assert.deepEqual(dirs, [SKILL]);

  const root = path.join(SKILLS, 'get-evidence');
  for (const entry of ['SKILL.md', 'references', 'assets', 'scripts']) {
    assert.ok(fs.existsSync(path.join(root, entry)), `missing ${entry}`);
  }

  // Every path the skill and its references name has to resolve, or the agent reads the
  // instruction and finds nothing there.
  const docs = ['SKILL.md', ...fs.readdirSync(path.join(root, 'references')).map((f) => `references/${f}`)];
  const missing = [];
  for (const doc of docs) {
    const body = fs.readFileSync(path.join(root, doc), 'utf8');
    for (const ref of body.match(/(?:references|assets|scripts)\/[A-Za-z0-9_.-]+/g) ?? []) {
      if (!fs.existsSync(path.join(root, ref))) missing.push(`${doc} -> ${ref}`);
    }
  }
  assert.deepEqual(missing, []);
});

test('the skill declares the name every manifest and the installer use', () => {
  const frontmatter = read('src/skills/get-evidence/SKILL.md').split('---')[1];
  assert.match(frontmatter, new RegExp(`^name: ${SKILL}$`, 'm'));
  assert.match(frontmatter, /^description: .+/m);
});

test('the installer installs the plugin under the identifier the manifests declare', () => {
  const script = read('scripts/install-local.sh');
  assert.ok(script.includes(`${PLUGIN}@${MARKETPLACE}`), 'installer uses a different plugin id');
  assert.ok(script.includes(`TOMOSIA-VIETNAM/${MARKETPLACE}`), 'installer adds a different marketplace');
});

test('the installer looks for the skill where the skill actually is', () => {
  const script = read('scripts/install-local.sh');
  assert.match(script, /\$REPO"\/src\/skills\//);
  assert.match(script, /ln -s -- "\$REPO\/src\/skills\/\$name"/);
  assert.match(script, /cp -R -- "\$REPO\/src\/skills\/\$name"/);
});

test('the installer sets up the Node dependency the runner cannot start without', () => {
  const script = read('scripts/install-local.sh');
  assert.match(script, /npm install --prefix/);
  assert.ok(fs.existsSync(path.join(SKILLS, 'get-evidence', 'scripts', 'package.json')));
});

test('install.sh ships everything a run needs', () => {
  const ship = read('install.sh').match(/^SHIP='([\s\S]*?)'/m);
  assert.ok(ship, 'install.sh no longer states what it ships');
  const entries = ship[1].split(/\s+/).filter(Boolean).map((e) => e.replace(/^\/|\/$/g, ''));

  const needed = ['src', 'scripts/install-local.sh', 'commands', ...MANIFESTS];
  const missing = needed.filter((n) => !entries.some((e) => e === n || n.startsWith(`${e}/`)));
  assert.deepEqual(missing, [], 'install.sh does not ship these');
});

test('install.sh ships nothing that only matters to someone editing this project', () => {
  const ship = read('install.sh').match(/^SHIP='([\s\S]*?)'/m)[1];
  for (const dev of ['/tests/', '/evals/', '/CONTRIBUTING.md']) {
    assert.ok(!ship.includes(dev), `${dev} has no business on a user's disk`);
  }
});

test("Gemini CLI's command finds the skill in the directories the installer writes to", () => {
  const toml = read('commands/get-evidence.toml');
  const script = read('scripts/install-local.sh');
  // The installer names $HOME-relative directories; the command has to look in the shared one.
  const targets = [...script.matchAll(/printf '%s\\n' "\$HOME\/([^"]+)"/g)].map((m) => m[1]);
  assert.ok(targets.length > 0, 'install-local.sh no longer states its target directories');
  assert.ok(targets.includes('.agents/skills'), 'the interoperable directory is no longer a target');
  assert.match(toml, /~\/\.agents\/skills\/get-evidence\/SKILL\.md/);
});
