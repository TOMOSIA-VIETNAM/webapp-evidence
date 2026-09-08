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

// Claude Code prefixes the plugin name onto the skill's own name, so `/webapp-evidence:recording`
// comes from a skill called `recording`. The other four platforms have no prefix, so the installer
// joins the plugin name to it there. One name is written down; the other is derived.
const MARKETPLACE = 'webapp-evidence';   // the repository, which is what a user adds
const PLUGIN = 'webapp-evidence';        // the namespace Claude Code prefixes onto the skill
const SKILL_DIR = 'recording';           // the directory and the SKILL.md name
const SKILL_NAME = 'webapp-evidence-recording'; // derived for the platforms with no namespace

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

test('the two invocation names agree with the manifests they come from', () => {
  const entry = readJson('.claude-plugin/marketplace.json').plugins[0];
  assert.equal(`${entry.name}:${SKILL_DIR}`, 'webapp-evidence:recording');
  assert.equal(`${entry.name}-${SKILL_DIR}`, SKILL_NAME);
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
  assert.deepEqual(dirs, [SKILL_DIR]);

  const root = path.join(SKILLS, SKILL_DIR);
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

test('the skill is named for how it reads after the plugin prefix', () => {
  // Claude Code shows `/<plugin>:<skill name>`, so a skill called webapp-evidence-recording inside
  // plugin webapp-evidence produces `/webapp-evidence:webapp-evidence-recording`.
  const frontmatter = read(`src/skills/${SKILL_DIR}/SKILL.md`).split('---')[1];
  assert.match(frontmatter, new RegExp(`^name: ${SKILL_DIR}$`, 'm'));
  assert.ok(!SKILL_DIR.startsWith(PLUGIN), 'the plugin name is said twice in the command');
  assert.match(frontmatter, /^description: .+/m);
});

test('the skill refers to its bundled files by relative path', () => {
  // The platform that loaded SKILL.md already resolved where it lives, so a path is all that is
  // needed. Anything else — a variable to expand, a directory to search for — is work the skill
  // pays for on every run to learn something its host already knew.
  const skill = read(`src/skills/${SKILL_DIR}/SKILL.md`);
  assert.ok(!skill.includes('$SKILL'), 'the skill expects a variable to be set before it can run');
  assert.ok(!skill.includes('CLAUDE_PLUGIN_ROOT'), 'the skill resolves a path only one platform provides');
  assert.match(skill, /node scripts\/record\.js/, 'the runner is no longer referenced by relative path');
});

test('the skill offers to fix a missing dependency rather than reciting install steps', () => {
  // Install commands differ per machine and go stale in a document. The agent can read what is
  // there and act; a list of brew/apt lines in the skill only competes with what it already knows.
  const skill = read(`src/skills/${SKILL_DIR}/SKILL.md`);
  assert.match(skill, /offer to install it yourself/);
  assert.ok(!skill.includes('brew install'), 'the skill recites an install command');
  assert.ok(!skill.includes('apt-get install'), 'the skill recites an install command');
});

test('the description stays short enough to read in a command list', () => {
  // It is shown next to the command while someone types, wrapped into the terminal width. Past a
  // few lines it stops being a hint and becomes a wall.
  const description = read(`src/skills/${SKILL_DIR}/SKILL.md`)
    .split('---')[1].match(/^description: (.+)$/m)[1];
  assert.ok(description.length < 320, `description is ${description.length} chars`);
});

test('the installer derives the unprefixed platforms\' name from the plugin name', () => {
  // Written down in SKILL.md it would be a second copy to keep in step with plugin.json.
  const script = read('scripts/install-local.sh');
  assert.match(script, /SKILL_NAMES\+=\("\$PLUGIN-\$name"\)/);
  assert.match(script, /plugin\.json/);
  assert.match(script, /ln -s -- "\$REPO\/src\/skills\/\$\{SKILL_DIRS\[\$i\]\}"/);
});

test('the installer installs the plugin under the identifier the manifests declare', () => {
  const script = read('scripts/install-local.sh');
  assert.ok(script.includes(`${PLUGIN}@${MARKETPLACE}`), 'installer uses a different plugin id');
  assert.ok(script.includes(`TOMOSIA-VIETNAM/${MARKETPLACE}`), 'installer adds a different marketplace');
});

test('the installer looks for the skill where the skill actually is', () => {
  const script = read('scripts/install-local.sh');
  assert.match(script, /\$REPO"\/src\/skills\//);
  assert.match(script, /cp -R -- "\$REPO\/src\/skills\/\$\{SKILL_DIRS\[\$i\]\}"/);
});

test('the installer sets up the Node dependency the runner cannot start without', () => {
  const script = read('scripts/install-local.sh');
  assert.match(script, /npm install --prefix/);
  assert.ok(fs.existsSync(path.join(SKILLS, SKILL_DIR, 'scripts', 'package.json')));
});

test('install.sh can follow a branch or a tag, and remembers which', () => {
  // Installing from a branch is how someone tries a change before it is released, and how a team
  // pins itself to a tag. Re-running the one-liner must not silently drop them back onto releases.
  const script = read('install.sh');
  assert.match(script, /--ref\)/, 'no --ref flag');
  assert.match(script, /--ref=\?\*\)/, 'no --ref=value form');
  assert.match(script, /"\$ref" = latest/, '`--ref latest` has no way back to releases');
  assert.match(script, /git -C "\$home" config webapp-evidence\.ref/, 'the chosen ref is not recorded');
  assert.match(script, /config --get webapp-evidence\.ref/, 'a later run does not read the recorded ref');
});

test('--update follows the recorded ref rather than whatever branch is default', () => {
  // A clone checked out at a tag has no upstream branch to pull, so a bare `git pull` there either
  // fails or quietly moves the clone somewhere the user did not ask for.
  const script = read('scripts/install-local.sh');
  assert.match(script, /config --get webapp-evidence\.ref/);
  assert.match(script, /fetch --quiet --depth 1 origin "\$REF"/);
  assert.match(script, /checkout --quiet --detach FETCH_HEAD/);
});

test('a pinned ref that no longer exists tells the user how to get out', () => {
  // A branch someone installed from gets merged and deleted, and from then on every plain run of
  // the one-liner fails on a ref name they never typed. Without a way out in the message itself,
  // the only fix is knowing `--ref latest` exists.
  const script = read('install.sh');
  assert.match(script, /missing_ref\(\)/, 'no handler for a ref that disappeared');
  const handler = script.slice(script.indexOf('missing_ref() {'), script.indexOf('# Everything lives in main'));
  assert.match(handler, /--ref latest/, 'the message does not name the way back to releases');
  assert.match(handler, /rm -rf/, 'the message does not offer starting over');

  const local = read('scripts/install-local.sh');
  assert.match(local, /config --unset webapp-evidence\.ref/, '--update leaves no way out either');
});

test('every translated README is reachable from every other one', () => {
  // A translation nobody can navigate to is a translation nobody reads, and a switcher that lists
  // a file which does not exist is a 404 on the front page.
  const readmes = ['README.md', 'README.vi-VN.md', 'README.ja-JP.md', 'README.zh-Hans.md'];
  for (const file of readmes) {
    assert.ok(fs.existsSync(path.join(REPO, file)), `${file} is missing`);
    const body = read(file);
    for (const other of readmes.filter((f) => f !== file)) {
      assert.ok(body.includes(`./${other}`), `${file} does not link to ${other}`);
    }
  }
});

test('a translation keeps the commands and the demo the English one shows', () => {
  // Prose is translated; a command is not. A reader following the Vietnamese page has to be able to
  // paste the same lines and land in the same place.
  const english = read('README.md');
  const fences = (body) => (body.match(/```/g) ?? []).length;
  for (const file of ['README.vi-VN.md', 'README.ja-JP.md', 'README.zh-Hans.md']) {
    const body = read(file);
    assert.equal(fences(body), fences(english), `${file} has a different number of code blocks`);
    assert.ok(body.includes('claude plugin install webapp-evidence@webapp-evidence'), `${file} lost the install command`);
    assert.ok(body.includes('./docs/demo/saucedemo.gif'), `${file} lost the demo recording`);
    assert.ok(body.includes('/webapp-evidence:recording'), `${file} lost the invocation`);
  }
});

test('the demo gif is wider than the width the README displays it at', () => {
  // A gif narrower than its display width gets scaled UP by the browser, and the text in it goes
  // soft — which is exactly how the first one shipped. Wider means the browser scales down.
  const gif = fs.readFileSync(path.join(REPO, 'docs/demo/saucedemo.gif'));
  const width = gif.readUInt16LE(6);   // logical screen width, bytes 6-7 of the GIF header
  const displayed = Number(read('README.md').match(/saucedemo\.gif" width="(\d+)"/)[1]);
  assert.ok(width >= displayed, `gif is ${width}px but shown at ${displayed}px`);
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
  const toml = read(`commands/${SKILL_NAME}.toml`);
  const script = read('scripts/install-local.sh');
  // The installer names $HOME-relative directories; the command has to look in the shared one.
  const targets = [...script.matchAll(/printf '%s\\n' "\$HOME\/([^"]+)"/g)].map((m) => m[1]);
  assert.ok(targets.length > 0, 'install-local.sh no longer states its target directories');
  assert.ok(targets.includes('.agents/skills'), 'the interoperable directory is no longer a target');
  assert.match(toml, new RegExp(`~/\\.agents/skills/${SKILL_NAME}/SKILL\\.md`));
});
