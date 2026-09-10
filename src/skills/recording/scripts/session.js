// Shared part of record.js and inspect.js: read the project config, remember the account,
// prepare the environment, sign in and hand back an already signed-in page.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const { chromium } = require('playwright-core');
const { resolveSettings } = require('./settings');

const VIEWPORT = { width: 1280, height: 800 };
const SKILL_DIR = path.resolve(__dirname, '..');
const ROOT = process.env.PROJECT_ROOT || process.cwd();

// The skill directory is a shared asset for every project: everything produced by a recording (config,
// account, step script, results, temporary test files) belongs to the project and must not live here. Block it
// early instead of letting junk pile up and then bleed into another project.
function assertOutsideSkill(target, what) {
  const resolved = path.resolve(target);
  if (resolved === SKILL_DIR || resolved.startsWith(`${SKILL_DIR}${path.sep}`)) {
    throw new Error(
      `${what} points inside the skill directory (${resolved}).\n` +
      'Run again from the project root, or point PROJECT_ROOT / OUT_DIR at a path inside the project.'
    );
  }
  return resolved;
}

assertOutsideSkill(ROOT, 'The working directory');

const HELP_ENV = `Environment variables:
    EVIDENCE_CONFIG   Path to the project config (default: probe upward from the step script directory)
    BASE_URL          Override the base URL of the app
    HEADED=1          Show the browser window (hidden by default, so the user cannot interact by accident)
    BROWSER_CHANNEL   Playwright browser channel (default: chrome)
    CAPTURE           page (default) | window | screen — what the frame of the recording is.
                      page records page content and runs headless. window records the browser
                      window through ffmpeg, so what the operating system draws inside it is in
                      the video too; screen records the whole display. Both show the window, so
                      both imply HEADED=1.
    SCREEN_CAPTURE=1  Required for window and screen: they record what is on someone's screen,
                      so the operator has to have agreed before the run starts.`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// The runner knows nothing about a specific app: the URL, how to prepare the environment and how to sign in
// are all declared by the project in evidence.config.js.
//
// Search from nearest to farthest, so one issue can have its own config sitting next to the step script
// while still falling back to the shared project config when nothing special is needed:
//   1. EVIDENCE_CONFIG
//   2. <step script directory>/evidence.config.js
//   3. walk up level by level: <level>/evidence.config.js or <level>/evidence/evidence.config.js
//   4. <root>/.claude/evidence.config.js
function configCandidates(startDir) {
  const found = [];
  let dir = startDir ? path.resolve(startDir) : ROOT;
  const stop = path.parse(dir).root;
  while (true) {
    found.push(path.join(dir, 'evidence.config.js'));
    found.push(path.join(dir, 'evidence', 'evidence.config.js'));
    if (dir === ROOT || dir === stop) break;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  found.push(path.join(ROOT, '.claude/evidence.config.js'));
  return found;
}

// When running from the project root (for example while probing selectors, before any step script exists) the
// upward walk does not pass through where the config lives, so scan a few levels down as well instead of
// forcing the user to type --config.
function scanForConfig(maxDepth = 3) {
  const skip = new Set(['node_modules', '.git', 'tmp', 'log', 'coverage', 'public', 'vendor']);
  const found = [];
  const walk = (dir, depth) => {
    if (depth > maxDepth || found.length > 5) return;
    let entries = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.isFile() && entry.name === 'evidence.config.js') found.push(path.join(dir, entry.name));
      if (entry.isDirectory() && !entry.name.startsWith('.') && !skip.has(entry.name)) {
        walk(path.join(dir, entry.name), depth + 1);
      }
    }
  };
  walk(ROOT, 0);
  return found;
}

function loadProjectConfig(startDir) {
  if (process.env.EVIDENCE_CONFIG) {
    const file = path.resolve(process.env.EVIDENCE_CONFIG);
    if (!fs.existsSync(file)) throw new Error(`Config not found: ${file}`);
    return { file, config: require(file) };
  }
  for (const file of configCandidates(startDir)) {
    if (fs.existsSync(file)) return { file, config: require(file) };
  }

  const scanned = scanForConfig();
  if (scanned.length === 1) return { file: scanned[0], config: require(scanned[0]) };
  if (scanned.length > 1) {
    throw new Error(
      `Several evidence.config.js found, pick one with EVIDENCE_CONFIG=<path>:\n` +
      scanned.map((f) => `  ${f}`).join('\n')
    );
  }

  // Not every recording belongs to a project. Someone who was handed a URL and a description of what
  // to show — no repository, no dev environment to bring up, nothing to log into — has nothing to put
  // in a config file, and demanding one would stop a recording that needs no setup at all. BASE_URL
  // says that much on its own, so stand in a config with exactly that and let the run proceed.
  if (process.env.BASE_URL) {
    return { file: null, config: { defaultApp: 'app', apps: { app: { baseUrl: process.env.BASE_URL } } } };
  }

  throw new Error(
    'No evidence.config.js found.\n' +
    `Create one from ${path.join(__dirname, '../assets/evidence.config.example.js')},\n` +
    'and put it next to the step script (per-issue config) or in the shared evidence directory of the project.\n' +
    'For a one-off recording of a site that needs no setup or sign-in, pass BASE_URL=<url> instead of writing a config.'
  );
}

// The login adapter of the project decides where the account comes from; the skill only handles reading and
// writing it so the next recording does not have to ask the user again.
// The account file holds a password and stays around for a long time, so requiring it to be ignored is
// mandatory here — there is no escape hatch like there is for the output directory.
function assertAccountStoreIgnored(file) {
  try {
    execFileSync('git', ['rev-parse', '--show-toplevel'], { stdio: 'ignore' });
  } catch {
    return; // not a git repo
  }
  try {
    execFileSync('git', ['check-ignore', '-q', file], { stdio: 'ignore' });
  } catch (e) {
    if (e.status !== 1) return;
    throw new Error(
      `The account file will contain a password but its location is not ignored yet:\n  ${file}\n\n` +
      'Move accountStore into an already ignored area of the project, or ask the user to add an ignore rule for it.'
    );
  }
}

function makeAccountStore(storePath) {
  const file = path.isAbsolute(storePath) ? storePath : path.join(ROOT, storePath);
  const readAll = () => {
    try {
      return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch {
      return { apps: {} };
    }
  };
  return {
    path: file,
    get: (app) => readAll().apps?.[app] || null,
    set(app, account) {
      assertAccountStoreIgnored(file);
      const data = readAll();
      data.apps = { ...(data.apps || {}), [app]: account };
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, { mode: 0o600 });
      return account;
    },
  };
}

// The password has to pass strength validators, so mix upper case, lower case, digits and symbols
function generatePassword() {
  const body = crypto.randomBytes(9).toString('base64url').replace(/[^A-Za-z0-9]/g, '');
  return `Ev${body}#7rq`;
}

function resolveApp(config, app) {
  const name = app || config.defaultApp;
  const appConfig = config.apps?.[name];
  if (!appConfig) throw new Error(`App "${name}" is not declared in the project config`);
  return { name, appConfig, baseUrl: process.env.BASE_URL || appConfig.baseUrl };
}

async function launchBrowser(settings) {
  const { headed, browserChannel, viewport } = settings.recording;
  return chromium.launch({
    headless: !headed,
    channel: browserChannel,
    args: headed ? ['--window-position=0,0', `--window-size=${viewport.width},${viewport.height + 120}`] : [],
  });
}

// The project prepares its own environment before the browser opens: an environment error screen that ends up
// in the evidence makes it useless. Returns the list of what was fixed so it can be printed for the user.
async function prepareApp({ appConfig, name, baseUrl }) {
  if (typeof appConfig.prepare !== 'function') return [];
  const result = await appConfig.prepare({ app: name, baseUrl, exec: execFileSync, root: ROOT });
  return Array.isArray(result) ? result : [];
}

async function signIn({ browser, appConfig, name, baseUrl, settings }) {
  if (typeof appConfig.login !== 'function') return undefined;
  const store = makeAccountStore(settings.output.accountStore);
  return appConfig.login({
    browser, app: name, baseUrl, viewport: settings.recording.viewport,
    store, generatePassword, exec: execFileSync,
  });
}

// JS errors and failed requests are what usually breaks a step script, and Playwright's timeout message does
// not say so. Collect them so that when something goes wrong you know right away whether it is the selector or
// the app being broken.
function watchProblems(page) {
  const problems = [];
  page.on('console', (msg) => {
    if (['error', 'warning'].includes(msg.type())) {
      problems.push(`[console.${msg.type()}] ${msg.text()}`.slice(0, 300));
    }
  });
  page.on('pageerror', (err) => problems.push(`[pageerror] ${String(err.message).slice(0, 300)}`));
  page.on('response', (res) => {
    if (res.status() >= 400) problems.push(`[http ${res.status()}] ${res.url().slice(0, 200)}`);
  });
  return problems;
}

// Session used for probing selectors: no recording, just a signed-in page.
async function openSession({ config, app }) {
  const settings = resolveSettings(config);
  const { name, appConfig, baseUrl } = resolveApp(config, app);
  const fixes = await prepareApp({ appConfig, name, baseUrl });
  const browser = await launchBrowser(settings);
  const storageState = await signIn({ browser, appConfig, name, baseUrl, settings });
  const context = await browser.newContext({
    viewport: settings.recording.viewport,
    locale: settings.recording.locale,
    storageState,
  });
  const page = await context.newPage();
  const problems = watchProblems(page);
  return { browser, context, page, baseUrl, app: name, storageState, fixes, config, settings, problems };
}

async function closeSession(session) {
  await session.context.close();
  await session.browser.close();
}

module.exports = {
  VIEWPORT, ROOT, SKILL_DIR, HELP_ENV, sleep, watchProblems, assertOutsideSkill, resolveSettings,
  loadProjectConfig, makeAccountStore, generatePassword,
  resolveApp, launchBrowser, prepareApp, signIn,
  openSession, closeSession,
};
