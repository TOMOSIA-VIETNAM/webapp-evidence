// The kinds of evidence that bring helpers of their own.
//
// Proving an endpoint works needs things no other recording needs: a request built from the
// session the browser is already holding, a response formatted so it can be read, cookies that
// must not survive into the video. Written into the skill document, that is a page every
// recording loads and almost none uses, and the next special kind of evidence after it makes
// that worse.
//
// So each kind is a directory under cases/, holding the page the agent reads when the flow is
// that kind and the helpers those steps call. What the runner hands a case is fixed and small —
// the page, the terminal, the project root, the output directory and the way to register a
// secret — because a case that needs more than that is a change made here, once, for all of
// them, rather than one case reaching into the runner for itself.
const fs = require('fs');
const path = require('path');

const REQUIRED_FILES = ['index.js', 'CASE.md'];

// A case that cannot be loaded stops the run before anything is recorded. The alternative is a
// step script calling a helper that silently is not there, which surfaces as `api is not
// defined` partway through a take that has already taken the operator's machine for a minute.
function loadCase(dir, name) {
  for (const file of REQUIRED_FILES) {
    if (fs.existsSync(path.join(dir, file))) continue;
    throw new Error(
      `The case in ${dir} has no ${file}.\n` +
      'A case is both files: CASE.md is what the agent reads when the evidence is that kind, ' +
      'index.js is what its steps call.'
    );
  }

  const loaded = require(path.join(dir, 'index.js'));
  if (loaded.name !== name) {
    throw new Error(
      `The case in ${dir} calls itself ${JSON.stringify(loaded.name)}.\n` +
      `A case is named by its directory, so that the row in SKILL.md, the directory and the ` +
      `name in an error message are all the same word: ${name}.`
    );
  }
  if (typeof loaded.helpers !== 'function') {
    throw new Error(
      `The case in ${dir} exports no helpers() function, so it adds nothing a step script can call.`
    );
  }
  return loaded;
}

function loadCases(dir) {
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => loadCase(path.join(dir, entry.name), entry.name));
}

// One scope holds every case's helpers, so a step script calls `api.from(...)` the way it calls
// `click(...)`. Two cases claiming the same name would mean the last directory read decides what
// a step script gets, which is a coin toss nobody would ever see land.
function applyCases(cases, runtime) {
  const helpers = {};
  const owners = {};
  for (const one of cases) {
    for (const [name, helper] of Object.entries(one.helpers(runtime) ?? {})) {
      if (name in helpers) {
        throw new Error(
          `The cases ${owners[name]} and ${one.name} both add a helper called ${name}.\n` +
          'A step script sees one scope, so the name has to say which case it came from.'
        );
      }
      helpers[name] = helper;
      owners[name] = one.name;
    }
  }
  return helpers;
}

module.exports = { loadCases, applyCases };
