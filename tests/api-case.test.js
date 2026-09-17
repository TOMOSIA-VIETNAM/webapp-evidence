// The curl line is the whole of what a viewer reads, and the cookie jar behind it is the whole of
// what they must not. Both are decided without a browser and without a shell, so both are checked
// here: the exact line built for each kind of request, and the promise that a session reaches the
// endpoint without ever reaching the screen.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const api = require('../src/skills/recording/cases/api');

const JAR = '/tmp/session/cookies.txt';
const SESSION = 'a1b2c3-this-is-the-session-value';

const options = (extra = {}) => ({
  method: 'GET', url: 'https://app.example.com/api/orders', jar: JAR, jq: true, ...extra,
});

test('a GET carries no -X: nobody types the verb curl already uses', () => {
  const line = api.buildCurl(options());
  assert.ok(!line.includes('-X'), line);
  assert.match(line, /^curl -sS 'https:\/\/app\.example\.com\/api\/orders'/);
});

test('the query is in the URL, and the URL is quoted so a & cannot end the command', () => {
  const line = api.buildCurl(options({ url: 'https://app.example.com/api/orders?page=2&status=open' }));
  assert.ok(line.includes("'https://app.example.com/api/orders?page=2&status=open'"), line);
});

test('a URL carrying shell syntax is quoted so the shell cannot run any of it', () => {
  // `new URL` percent-encodes a backtick and everything in a query string, and leaves `$(` and
  // `${` in a path alone — so the path is what reaches the command line able to run.
  const line = api.buildCurl(options({ url: 'https://app.example.com/r/$(touch /tmp/pwned)' }));
  assert.ok(line.includes("'https://app.example.com/r/$(touch /tmp/pwned)'"), line);
  assert.ok(!line.includes('"'), line);
});

test('a URL with a quote in it cannot close the quoting around it', () => {
  const line = api.buildCurl(options({ url: "https://app.example.com/r/'; id; '" }));
  assert.ok(line.includes(`'https://app.example.com/r/'\\''; id; '\\'''`), line);
});

test('a POST says so, sends the body, and declares what the body is', () => {
  const line = api.buildCurl(options({ method: 'POST', json: { sku: 'ABC', qty: 2 } }));
  assert.match(line, /curl -sS -X POST 'https:\/\/app\.example\.com\/api\/orders'/);
  assert.ok(line.includes("-H 'Content-Type: application/json'"), line);
  assert.ok(line.includes(`-d '${JSON.stringify({ sku: 'ABC', qty: 2 })}'`), line);
});

test('the status is written to standard error, so it is on screen without going through jq', () => {
  const line = api.buildCurl(options());
  assert.ok(line.includes("-w '%{stderr}HTTP %{http_code} in %{time_total}s\\n'"), line);
});

test('the session travels as a file, never as a flag carrying it along the command line', () => {
  const line = api.buildCurl(options());
  assert.ok(line.includes(`-b ${JAR}`), line);
});

test('a machine without jq gets the line without the pipe, not a stand-in for it', () => {
  const line = api.buildCurl(options({ jq: false, filter: '.orders[0:3]' }));
  assert.ok(!line.includes('|'), line);
  assert.ok(!line.includes('jq'), line);
  // And everything else about the request is unchanged: the response is read as it came back.
  assert.equal(line, api.buildCurl(options({ jq: true })).replace(' | jq', ''));
});

test('a filter is passed to jq, for a response too long to sit through', () => {
  assert.ok(api.buildCurl(options({ filter: '.orders[0:3]' })).endsWith("| jq '.orders[0:3]'"));
});

test('a bearer token goes into a config file, which is what -K is doing in the line', () => {
  const line = api.buildCurl(options({ config: '/tmp/session/auth.conf' }));
  assert.ok(line.includes('-K /tmp/session/auth.conf'), line);
});

test('the cookie jar curl reads says which host each cookie is for, and lasts the take', () => {
  const jar = api.netscapeJar([
    { name: 'session', value: SESSION, domain: 'app.example.com', path: '/', expires: -1, httpOnly: true, secure: true },
    { name: 'locale', value: 'en-GB', domain: '.example.com', path: '/', expires: 1893456000, secure: false },
  ]);
  const [header, first, second] = jar.trim().split('\n');
  assert.match(header, /^# Netscape HTTP Cookie File$/);
  assert.deepEqual(first.split('\t'), ['#HttpOnly_app.example.com', 'FALSE', '/', 'TRUE', '0', 'session', SESSION]);
  assert.deepEqual(second.split('\t'), ['.example.com', 'TRUE', '/', 'FALSE', '1893456000', 'locale', 'en-GB']);
});

// ---------- the request, as a step script makes it ----------

const cookies = [
  { name: 'session', value: SESSION, domain: 'app.example.com', path: '/', expires: -1, httpOnly: true, secure: true },
];

function harness(answers = []) {
  const events = [];
  const term = {
    async run(command) {
      events.push({ ran: command });
      return answers.shift() ?? { exitCode: 0, output: 'HTTP 200 in 0.012s\n{}\n' };
    },
  };
  const registerSecret = (value) => events.push({ registered: value });
  // The runner ends the take and so owns what the case leaves on disk; the harness collects the
  // same callbacks so a test can run them and see the session go.
  const disposers = [];
  const { api: helper } = api.helpers({ term, registerSecret, onDispose: (fn) => disposers.push(fn) });
  return {
    helper,
    events,
    ran: () => events.filter((e) => e.ran).map((e) => e.ran),
    dispose: async () => { for (const fn of disposers) await fn(); },
  };
}

const page = {
  url: () => 'https://app.example.com/orders',
  context: () => ({ cookies: async () => cookies }),
};

test('no cookie value appears in the command line the panel shows', async () => {
  const { helper, ran } = harness();
  const req = await helper.from(page);
  await req.curl('POST', '/api/orders', { json: { sku: 'ABC' }, expect: 200 });

  assert.equal(ran().length, 1);
  assert.ok(!ran()[0].includes(SESSION), ran()[0]);
  // It did travel: the file curl was handed is the one holding it.
  assert.ok(fs.readFileSync(req.jar, 'utf8').includes(SESSION));
});

test('every cookie value is a registered secret before the first command runs', async () => {
  const { helper, events } = harness();
  const req = await helper.from(page, { token: 'bearer-token-value' });
  await req.curl('GET', '/api/orders');

  const registered = events.filter((e) => e.registered).map((e) => e.registered);
  assert.deepEqual(registered, [SESSION, 'bearer-token-value']);
  assert.ok(events.findIndex((e) => e.ran) > events.findLastIndex((e) => e.registered),
    'a command ran before the session was registered as a secret');
});

test('a token read out of the page is collected the same way as one handed over', async () => {
  const { helper, events, ran } = harness();
  const req = await helper.from(page, { token: (p) => `${new URL(p.url()).host}-jwt` });
  await req.curl('GET', '/api/orders');

  assert.ok(events.some((e) => e.registered === 'app.example.com-jwt'));
  assert.ok(!ran()[0].includes('app.example.com-jwt'), ran()[0]);
  assert.ok(fs.readFileSync(req.config, 'utf8').includes('Authorization: Bearer app.example.com-jwt'));
});

test('a query is encoded into the URL of the request that runs', async () => {
  const { helper, ran } = harness();
  const req = await helper.from(page);
  await req.curl('GET', '/api/orders', { query: { status: 'open orders', page: 2 } });
  assert.ok(ran()[0].includes('/api/orders?status=open+orders&page=2'), ran()[0]);
});

test('the status the step asserted is the status it gets back', async () => {
  const { helper } = harness([{ exitCode: 0, output: 'HTTP 201 in 0.184s\n{"id":4102}\n' }]);
  const req = await helper.from(page);
  const answer = await req.curl('POST', '/api/orders', { json: { sku: 'ABC' }, expect: 201 });
  assert.equal(answer.status, 201);
});

test('a status other than the one asserted fails the take, quoting the answer', async () => {
  const { helper } = harness([{ exitCode: 0, output: 'HTTP 422 in 0.031s\n{"error":"sku is required"}\n' }]);
  const req = await helper.from(page);
  await assert.rejects(
    () => req.curl('POST', '/api/orders', { json: {}, expect: 201 }),
    (error) => {
      assert.match(error.message, /422/);
      assert.match(error.message, /201/);
      assert.match(error.message, /sku is required/);
      return true;
    },
  );
});

test('a request that never reached the endpoint says so rather than blaming the status', async () => {
  const { helper } = harness([{ exitCode: 7, output: 'curl: (7) Failed to connect to localhost port 3000\n' }]);
  const req = await helper.from(page);
  await assert.rejects(() => req.curl('GET', '/api/orders', { expect: 200 }), /Failed to connect/);
});

test('a response the pipe could not read is a failure even when the status was right', async () => {
  const { helper } = harness([{ exitCode: 5, output: 'HTTP 200 in 0.020s\nparse error: Invalid literal\n' }]);
  const req = await helper.from(page);
  await assert.rejects(() => req.curl('GET', '/api/orders', { expect: 200 }), /parse error/);
});

test('the session the case wrote is removed when the runner ends the take', async () => {
  const { helper, dispose } = harness();
  const req = await helper.from(page);
  assert.ok(fs.existsSync(req.jar), 'the cookie jar was never written');

  await dispose();
  assert.ok(!fs.existsSync(req.jar), 'the session outlived the take');
  assert.ok(!fs.existsSync(path.dirname(req.jar)), 'the session directory outlived the take');
});
