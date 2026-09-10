#!/usr/bin/env node
// The end-to-end check needs a real page in a real browser, and the one thing it must not need is
// somebody's project. This serves the demo app in tests/e2e/app on a port of its own, using nothing
// but Node's own http module, so the check runs the same on a laptop and in CI.
//
// Usage: node serve.js [port]   — prints the URL it is listening on, then serves until killed.
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, 'app');

// Where the "Run sync" button's work shows up. The end-to-end check points this at a scratch file
// and then proves, from the terminal panel inside the recording, that the lines arrived.
const LOG = process.env.DEMO_LOG;
let job = 0;

// Two lines, seconds apart, because that is the shape of the thing being demonstrated: the click
// returns immediately and the work finishes later. A take that could only ever match a line
// already on disk would not show waiting for anything.
function trigger() {
  if (!LOG) return;
  job += 1;
  const id = job;
  fs.appendFileSync(LOG, `SyncJob ${id} enqueued\n`);
  // Long enough that the take really is waiting for the line when it arrives. A job that
  // finished before the command to watch it was typed would prove the panel works and not that
  // waitFor does.
  setTimeout(() => fs.appendFileSync(LOG, `SyncJob ${id} finished, 3 records exported\n`), 9000);
}
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript' };

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const rel = url.pathname === '/' ? 'index.html' : url.pathname.replace(/^\/+/, '');
  // A browser asks for this on its own. Answering 404 would put a console error in the recording and
  // make the check fail on something the demo app never did.
  if (rel === 'favicon.ico') {
    res.writeHead(204);
    res.end();
    return;
  }

  // A page of one unmistakable colour. The window capture check samples it to prove the browser
  // window really is in the frame and at the position the crop put it: without Screen Recording
  // permission macOS hands back a picture of the desktop instead, which is not flat and not this.
  if (rel === 'solid') {
    res.writeHead(200, { 'content-type': TYPES['.html'] });
    res.end('<!doctype html><meta charset="utf-8"><title>Solid</title>'
      + '<style>html,body{margin:0;height:100%;background:#00b050}</style>');
    return;
  }

  if (rel === 'trigger') {
    trigger();
    res.writeHead(202, { 'content-type': 'text/plain' });
    res.end('queued');
    return;
  }

  const file = path.join(ROOT, rel);

  // Everything under app/ is served, nothing above it: a path that escapes the directory is a bug
  // in the step script, not something to resolve helpfully.
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('not found');
    return;
  }

  res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
  res.end(fs.readFileSync(file));
});

const port = Number(process.argv[2]) || 0;
server.listen(port, '127.0.0.1', () => {
  console.log(`http://127.0.0.1:${server.address().port}`);
});
