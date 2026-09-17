# Cases — one directory per kind of evidence the main skill routes to

## The gap this closes

Proving an API endpoint works needs things no other recording needs: a request built from the
session the browser is already holding, a response formatted so it can be read, cookies and tokens
that must not survive into the video. Written into `SKILL.md` it is a page every recording loads
and almost none use, and the next special kind of evidence after it makes that worse.

## What a case is

A directory under `src/skills/recording/cases/` holding two files:

| File | For |
|---|---|
| `CASE.md` | The agent, read only when the flow is that kind. When to use it, how to write the steps, what it refuses to do |
| `index.js` | The helpers those steps call, merged into the scope a step script runs in |

`SKILL.md` carries one row per case: what the case is for, and the file to read. That row is the
whole coordination — the main document says when to go and reads nothing itself.

`record.js` loads every case directory it finds. Adding a case is a directory and a row; no file
that already exists is edited except the table.

A case may not reach into another case, and the runner exposes the same things to all of them: the
page, the terminal, the redaction list, the project root. A case that needs more than that is a
change to the runner, made once, for everyone.

## The first case: `api`

A recording proves an endpoint works by calling it in the terminal panel, in front of the viewer,
with the session the browser is holding — not by quoting a request and a response the reviewer
would have to trust.

```js
const req = await api.from(page);

mark('POST /api/orders returns 201');
await req.curl('POST', '/api/orders', { json: { sku: 'ABC', qty: 2 }, expect: 201 });
```

What the panel shows is one real `curl` line and its response:

```
$ curl -sS -X POST "$BASE/api/orders" -H 'Content-Type: application/json' \
    -b .cookies -d '{"sku":"ABC","qty":2}' -w '%{stderr}HTTP %{http_code} in %{time_total}s\n' | jq
HTTP 201 in 0.184s
{
  "id": 4102,
  "status": "pending",
  ...
```

- **The session comes from the browser**, so the request is the one the signed-in user would make:
  `page.context().cookies()` for the origin, written to a cookie jar outside the project, plus
  whatever `from()` is told to read out of the page for a bearer token.
- **The cookie jar is a file, not a `-b` flag.** A session written along the command line is a
  secret on screen for as long as the command is. As a file it never appears, and the commands the
  viewer reads stay short enough to read.
- **Every cookie value and every token is registered as a secret** before the first command runs,
  so anything that echoes one back is blacked out in the panel, the runbook and the screenshots.
  This is not optional and there is no flag to turn it off: the alternative is a session token in
  an mp4 attached to a merge request.
- **`expect` is the assertion.** The status line goes to standard error so it is on screen without
  going through `jq`; `expect: 201` fails the take when it does not match, and the runbook records
  it in the same shape as a `waitFor`.
- **`jq` when the machine has it.** When it does not, the pipe is left off rather than replaced
  with something that is not what a person would have typed, and the runbook says so.

## Typing a command versus writing a script

An agent writing a step script reaches for a shell file, a `cat` to show it and a `sh` to run it.
Nobody works that way for one request: they type the request.

So the helper makes the short way the easy way — `req.curl(...)` is one typed line — and there is a
separate call for the case that genuinely needs a file:

`term.script(path)` writes the file before the panel opens and shows only `cat` and the run, which
is what someone with that file already in their repository would do. A file that appears in the
video is one that was worth writing.

## What a case does not get to do

- Change how a recording is captured, paced or encoded.
- Write anything into the skill directory, including its own scratch files.
- Put a credential on screen or in the runbook.

## What the typed command costs, and why it is still typed

The `curl` line runs to about 160 characters, and the runner types it at the speed a person types,
so one request is roughly eleven seconds of video. A flow proving five endpoints spends a minute on
typing alone.

It stays that way. The command is the evidence: a reviewer watching the panel can see which method
went to which URL carrying which body, and check the status against it. Folding the flags into a
`curl -K` config file to save the seconds would leave a line that proves a request was made and
says nothing about what was in it.

What the case does instead is keep the line as short as it honestly can be: the session lives in a
file whose directory name is short, and there is nothing on the line that is not part of the
request.

A flow with many endpoints in it is the case for a script — `term.script()` shows the file once and
runs it — rather than the case for a shorter `curl`.
