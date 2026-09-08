// The config-free path needs a project root with no evidence.config.js anywhere below it, which the
// other session tests cannot offer: they scatter configs across their own scratch trees, and the
// shallow scan finds those first. Each test file runs in its own process, so this one gets an empty
// root of its own.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const PROJECT = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'evidence-bare-')));
process.env.PROJECT_ROOT = PROJECT;

const { loadProjectConfig, resolveApp } = require('../src/skills/recording/scripts/session');

function withBaseUrl(value, fn) {
  const saved = process.env.BASE_URL;
  if (value === undefined) delete process.env.BASE_URL; else process.env.BASE_URL = value;
  try {
    return fn();
  } finally {
    if (saved === undefined) delete process.env.BASE_URL; else process.env.BASE_URL = saved;
  }
}

test('BASE_URL alone records a site that needs no setup and no sign-in', () => {
  // Someone handed a URL and a description of what to show has no project to configure. Demanding a
  // config file would block a recording that needs none of what a config file holds.
  const { file, config } = withBaseUrl('http://localhost:4321', () => loadProjectConfig(PROJECT));
  assert.equal(file, null);

  const app = withBaseUrl('http://localhost:4321', () => resolveApp(config, undefined));
  assert.equal(app.baseUrl, 'http://localhost:4321');
  assert.equal(typeof config.apps[app.name].login, 'undefined');
  assert.equal(typeof config.apps[app.name].prepare, 'undefined');
});

test('without BASE_URL and without a config, the error offers both ways out', () => {
  const error = withBaseUrl(undefined, () => {
    try {
      loadProjectConfig(PROJECT);
      return null;
    } catch (e) {
      return e.message;
    }
  });
  assert.ok(error, 'expected a missing-config error');
  assert.match(error, /evidence\.config\.js/);
  assert.match(error, /BASE_URL/);
});

test.after(() => fs.rmSync(PROJECT, { recursive: true, force: true }));
