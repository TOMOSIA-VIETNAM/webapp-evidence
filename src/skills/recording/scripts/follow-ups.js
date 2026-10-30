// What the agent offers the user once a take is handed over, each at most once per machine: the
// feedback command after the very first take, and starring the plugin's repository when this
// GitHub account has not. The runner only prints lines for the agent to act on — SKILL.md, "Closing
// the report" — and never writes to GitHub itself.
//
// The star check runs in the background while the take records, so the user sees no command and
// waits for nothing. No gh, not signed in, offline: it prints nothing and tries again next take.
// STAR_CHECK=0 turns it off for anyone who would rather the runner did not call GitHub at all.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');

const REPO = require('./package.json').repository.replace(/^github:/, '');

// Per user, not per project: nothing the runner writes belongs in someone's working tree, and the
// temporary directory would forget it on the next reboot.
const stateFile = () => path.join(
  process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'),
  'webapp-evidence',
  'state.json',
);

function readState() {
  try {
    return JSON.parse(fs.readFileSync(stateFile(), 'utf8'));
  } catch {
    return {};
  }
}

function writeState(fields) {
  const file = stateFile();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify({ ...readState(), ...fields }, null, 2)}\n`);
}

// 'starred', 'not-starred', or null when it cannot tell. The API answers 404 for "not starred".
function starStatus() {
  return new Promise((resolve) => {
    execFile('gh', ['api', `user/starred/${REPO}`, '--silent'], { timeout: 10000 }, (error, _out, stderr) => {
      if (!error) resolve('starred');
      else resolve(/HTTP 404/.test(String(stderr)) ? 'not-starred' : null);
    });
  });
}

// Called as a take starts. Returns what to call once it is handed over, which resolves to the lines
// to print. A take that fails never gets there, so a failure neither offers the star nor uses it up.
function startFollowUps({ check = starStatus } = {}) {
  const state = readState();
  const firstTake = !state.firstTakeAt;
  if (firstTake) writeState({ firstTakeAt: new Date().toISOString() });
  const skip = state.star || process.env.STAR_CHECK === '0';
  const star = skip ? Promise.resolve(null) : check().catch(() => null);

  return async () => {
    const lines = [];
    if (firstTake) lines.push('FIRST TAKE: the first take recorded on this machine');
    const status = await star;
    if (status) writeState({ star: status === 'starred' ? 'starred' : 'offered' });
    if (status === 'not-starred') lines.push(`STAR: ${REPO} is not starred by this GitHub account`);
    return lines;
  };
}

module.exports = { startFollowUps, REPO };
