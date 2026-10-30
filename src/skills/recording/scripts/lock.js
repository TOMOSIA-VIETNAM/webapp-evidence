// One take at a time per project.
//
// Two runs against the same project are not independent, even when each is pointed at its own port:
// they share the application's build cache and whatever state its development server keeps. What
// that looks like from inside a take is not a message about another run — it is a blank page in one
// and a 404 from a route the application does define in the other, so the step script looks wrong,
// or the application does, while the real cause is the run beside it.
//
// The lock is a file in the temporary directory rather than in the project: nothing the runner
// writes belongs in someone's working tree. It is created exclusively, so two runs starting in the
// same instant cannot both believe they hold it, and a lock left behind by a process that is gone
// is taken over rather than obeyed.
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const DIR = path.join(os.tmpdir(), 'webapp-evidence-locks');

const fileFor = (projectRoot) => path.join(
  DIR,
  `${crypto.createHash('sha1').update(path.resolve(projectRoot)).digest('hex').slice(0, 16)}.lock`,
);

// Signal 0 delivers nothing and reports whether it could have. EPERM means the process is there
// and owned by somebody else, which for this purpose is the same as running.
function isRunning(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === 'EPERM';
  }
}

function readHolder(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    // Unreadable or half-written: whoever wrote it is in no state to be waited for.
    return null;
  }
}

// What the run holding the lock is doing, in the words of whoever reads the refusal. Probing a
// screen takes the same lock as recording, and naming the wrong one sends the reader looking for a
// take that does not exist — which is the kind of misdirection this lock exists to end.
const DOING = {
  take: { held: 'A take is already recording this project', is: 'a take' },
  probe: { held: 'A screen is already being probed in this project', is: 'a probe' },
};

function refusal(holder, file) {
  const doing = DOING[holder.kind] || DOING.take;
  const since = holder.startedAt ? Math.round((Date.now() - holder.startedAt) / 1000) : null;
  const when = since === null ? '' : `, started ${since}s ago`;
  const where = holder.outDir ? `, writing to ${holder.outDir}` : '';
  return new Error(
    `${doing.held} (process ${holder.pid}${when}${where}).\n` +
    'Two runs share the application\'s build cache and development-server state even when each ' +
    'has its own port, and what that does to the one that loses the race is a blank page, or a 404 ' +
    'from a route the application defines — neither of which points at the other run.\n' +
    `Wait for it to finish, or stop it and run again. If process ${holder.pid} is not ${doing.is}, ` +
    `delete ${file}.`
  );
}

// A run killed outright — SIGKILL, a crash — runs no handler, and the Chrome it launched outlives
// it: the browser and its GPU process keep running beside the next take's. On an Intel Mac two of
// them were enough to hang the GPU and restart the machine. So the browser's pid goes into the lock
// (recordBrowser), and a lock found with its run gone has that browser ended before it is removed.
// Playwright starts Chrome as the leader of its own process group, so the group takes its helpers
// with it.
//
// A pid alone is not enough to kill by: the lock outlives a restart, pids are handed out again, and
// the new owner can be another take's Chrome. So the process's start time goes in beside it, and a
// browser is ended only while both still match.
function processStart(pid) {
  try {
    return execFileSync('ps', ['-o', 'lstart=', '-p', String(pid)], { encoding: 'utf8' }).trim() || null;
  } catch {
    return null;   // gone, or no `ps` to ask
  }
}

function recordBrowser(projectRoot, browserPid) {
  update(projectRoot, { browserPid, browserStarted: browserPid ? processStart(browserPid) : null });
}

function endLeftBrowser(holder) {
  const pid = holder?.browserPid;
  if (!Number.isInteger(pid) || pid <= 0 || !holder.browserStarted) return;
  if (processStart(pid) !== holder.browserStarted) return;
  try {
    process.kill(-pid, 'SIGKILL');
  } catch {
    // Already gone between the check and the kill
  }
}

// Locks left by runs that are gone, in every project: an interrupted take in one project leaves its
// Chrome running into the next take, whichever project that is in.
function clearLeftBehind() {
  let files = [];
  try { files = fs.readdirSync(DIR).filter((f) => f.endsWith('.lock')); } catch { return; }
  for (const name of files) {
    const file = path.join(DIR, name);
    const holder = readHolder(file);
    if (!holder || isRunning(holder.pid)) continue;
    endLeftBrowser(holder);
    try { fs.unlinkSync(file); } catch { /* another run got to it first */ }
  }
}

// Take the lock, or refuse with what is holding it. Returns a release function; calling it more
// than once, or after another run has taken the lock over, does nothing.
function acquire(projectRoot, { outDir = null, pid = process.pid, kind = 'take' } = {}) {
  fs.mkdirSync(DIR, { recursive: true });
  clearLeftBehind();
  const file = fileFor(projectRoot);
  const mine = JSON.stringify({
    pid, outDir, kind, startedAt: Date.now(), project: path.resolve(projectRoot),
  });

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      fs.writeFileSync(file, mine, { flag: 'wx' });
      return () => release(file, pid);
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      const holder = readHolder(file);
      if (holder && holder.pid !== pid && isRunning(holder.pid)) throw refusal(holder, file);
      // Left behind by a run that is no longer there — a crash, or a machine that restarted.
      if (holder?.pid !== pid) endLeftBrowser(holder);
      try { fs.unlinkSync(file); } catch { /* another run got to it first */ }
    }
  }
  throw new Error(
    `Could not take the recording lock at ${file}: another run keeps taking it first.\n` +
    'Record again once that one has finished.'
  );
}

// Synchronous, and never throws: it is called from a signal handler as well as from the ordinary
// path, and there is no turn of the event loop left in one of those.
function release(file, pid = process.pid) {
  const holder = readHolder(file);
  if (holder && holder.pid !== pid) return;   // already taken over; not ours to remove
  try { fs.unlinkSync(file); } catch { /* already gone */ }
}

// Add to what the lock says about the run holding it — what a screen take is doing at the moment,
// for the menu bar item to show. Only the holder writes, and only while it still holds the lock.
// Written beside the lock and renamed over it: a run reading a half-written lock takes it for one
// left behind and removes it, so the file must never be seen half-written.
function update(projectRoot, fields, pid = process.pid) {
  const file = fileFor(projectRoot);
  const holder = readHolder(file);
  if (!holder || holder.pid !== pid) return;
  const next = `${file}.${pid}.tmp`;
  try {
    fs.writeFileSync(next, JSON.stringify({ ...holder, ...fields }));
    fs.renameSync(next, file);
  } catch {
    // A status nobody can see is not worth failing a take over
    try { fs.unlinkSync(next); } catch { /* never written */ }
  }
}

module.exports = { acquire, update, recordBrowser, processStart, fileFor, isRunning, DIR };
