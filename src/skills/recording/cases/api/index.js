// Calling an endpoint in front of the viewer, with the session the browser is holding.
//
// A recording proves an endpoint works by making the request on screen, not by quoting a request
// and a response the reviewer would have to trust. That needs three things this file owns:
//
//   the session   the cookies the signed-in browser already has, handed to curl as a file
//   the secrets   every one of those values registered before the first command is typed
//   the status    written where it is readable on screen, and compared against what was asserted
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

// The status line curl writes for every request. It goes to standard error so it reaches the
// panel whether or not the body is piped through anything, and it is the only part of the
// response this file reads: `expect` is checked against the number in it.
const STATUS = 'HTTP ';
const STATUS_LINE = /HTTP (\d{3}) in [\d.]+s/;

// How much of the response a failure message quotes. Enough to recognise a validation error or a
// stack trace; not so much that the reason scrolls off the top of the agent's own output.
const BODY_LINES = 10;

// A session written along the command line is a secret on screen for as long as the command is,
// and the command is in the video and in the runbook. As files, neither the cookies nor the
// bearer token ever appear — and the line stays short enough to read.
//
// Outside the project and outside the skill directory, because nothing a recording produces
// belongs in either, and this one holds a live session on disk.
//
// The shortest system temp directory the machine has, because this path is typed into the video
// character by character: os.tmpdir() on macOS is a fifty-character per-user folder, and every
// one of those characters is time a viewer spends watching a path scroll past. /tmp is the system
// temp wherever this panel runs at all — it needs a POSIX shell — and the files below are written
// 0600, so a directory everyone can write to does not make a session anyone can read.
const TEMP = fs.existsSync('/tmp') ? '/tmp' : os.tmpdir();
const sessionDir = () => fs.mkdtempSync(path.join(TEMP, 'evidence-session-'));

// The format curl reads: one tab-separated row per cookie. Playwright answers -1 for a cookie
// that lasts as long as the browser session, which is a past date to curl and would drop the
// cookie it matters most to send.
function netscapeJar(cookies) {
  const rows = cookies.map((cookie) => [
    `${cookie.httpOnly ? '#HttpOnly_' : ''}${cookie.domain}`,
    cookie.domain.startsWith('.') ? 'TRUE' : 'FALSE',
    cookie.path || '/',
    cookie.secure ? 'TRUE' : 'FALSE',
    Math.max(0, Math.floor(cookie.expires ?? 0)),
    cookie.name,
    cookie.value,
  ].join('\t'));
  return `# Netscape HTTP Cookie File\n${rows.join('\n')}\n`;
}

// `jq` is what a person pipes a JSON response through. On a machine without it the pipe is left
// off and the response is read raw, rather than replaced by a formatter nobody would have typed
// into their own terminal.
function hasJq() {
  try {
    execFileSync('jq', ['--version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

// Only where it is needed: a quoted string full of backslashes is a line a viewer has to decode
// rather than read.
const quote = (text) => (/^[A-Za-z0-9_@%+=:,./-]+$/.test(text)
  ? text
  : `'${String(text).replace(/'/g, "'\\''")}'`);

// One curl line, in the order a person writes one: what to do, where, what to send, and what to
// report. `-sS` is the pair every scripted curl carries — quiet about progress, not about its own
// failures — and `-X GET` is left off because nobody types it.
function buildCurl({ method, url, jar, config, json, headers = {}, jq, filter }) {
  const line = ['curl', '-sS'];
  if (method !== 'GET') line.push('-X', method);
  line.push(`"${url}"`);
  for (const [name, value] of Object.entries(headers)) line.push('-H', quote(`${name}: ${value}`));
  if (json !== undefined) line.push('-H', quote('Content-Type: application/json'));
  line.push('-b', jar);
  // curl's own way of keeping a credential off the command line, which is where the Authorization
  // header would otherwise sit, in the frame, for as long as the command is on screen.
  if (config) line.push('-K', config);
  if (json !== undefined) line.push('-d', quote(JSON.stringify(json)));
  line.push('-w', quote(`%{stderr}${STATUS}%{http_code} in %{time_total}s\\n`));
  if (!jq) return line.join(' ');
  return `${line.join(' ')} | jq${filter ? ` ${quote(filter)}` : ''}`;
}

const readStatus = (output) => {
  const found = String(output).match(STATUS_LINE);
  return found ? Number(found[1]) : null;
};

const firstLines = (output) => String(output)
  .split('\n')
  .filter((row) => row.trim() && !STATUS_LINE.test(row))
  .slice(0, BODY_LINES)
  .join('\n');

function helpers({ term, registerSecret }) {
  // The page is passed in rather than taken from the runtime, so the line in the step script says
  // which page the session comes from — a take that signed in as two different users reads
  // correctly instead of quietly using whichever page the runner happened to hold.
  async function from(page, { token } = {}) {
    const origin = new URL(page.url()).origin;
    const cookies = await page.context().cookies(origin);
    const bearer = typeof token === 'function' ? await token(page) : token;

    // Before anything is typed, because a value registered after the command that echoed it is a
    // value that was on screen. There is no flag to turn this off: the alternative is a session
    // token in an mp4 attached to a merge request.
    cookies.forEach((cookie) => registerSecret(cookie.value));
    if (bearer) registerSecret(bearer);

    const dir = sessionDir();
    const jar = path.join(dir, 'cookies.txt');
    fs.writeFileSync(jar, netscapeJar(cookies), { mode: 0o600 });

    let config = null;
    if (bearer) {
      config = path.join(dir, 'auth.conf');
      fs.writeFileSync(config, `header = "Authorization: Bearer ${bearer}"\n`, { mode: 0o600 });
    }
    // The take is over by then, and what is left behind is a live session on the operator's disk.
    process.on('exit', () => { try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* gone already */ } });

    const jq = hasJq();

    return {
      jar,
      config,

      async curl(method, requestPath, { json, headers, query, expect, pause, jq: filter } = {}) {
        const url = new URL(requestPath, origin);
        for (const [name, value] of Object.entries(query ?? {})) {
          url.searchParams.set(name, value);
        }
        const verb = String(method).toUpperCase();
        const command = buildCurl({
          method: verb, url: url.toString(), jar, config, json, headers, jq, filter,
        });

        // Run as it would be from a keyboard: a 404 is an answer, not a broken shell, so the
        // status decides the outcome rather than curl's exit code.
        const result = await term.run(command, { allowFailure: true, pause });
        const status = readStatus(result.output);

        if (status === null) {
          throw new Error(
            `${verb} ${requestPath} never reached the endpoint (curl exited ${result.exitCode}).\n` +
            `${firstLines(result.output) || '(no output)'}`
          );
        }
        if (expect !== undefined && status !== expect) {
          throw new Error(
            `${verb} ${requestPath} answered ${status}, and the step asserted ${expect}.\n` +
            `${firstLines(result.output)}\n\n` +
            'The status is what makes the take evidence rather than a log, so a take that ' +
            'recorded the wrong one is not a take to keep.'
          );
        }
        if (result.exitCode !== 0) {
          throw new Error(
            `The endpoint answered ${status}, but the command exited ${result.exitCode}.\n` +
            `${firstLines(result.output) || '(no output)'}\n\n` +
            'A response jq cannot read is on screen as an error, whatever the status was.'
          );
        }
        return { status, output: result.output, command };
      },
    };
  }

  return { api: { from } };
}

module.exports = {
  name: 'api',
  helpers,
  // Exported for the tests: the command line is the whole of what a viewer reads, and every part
  // of deciding it is answerable without a browser or a shell.
  buildCurl, netscapeJar, readStatus, STATUS_LINE,
};
