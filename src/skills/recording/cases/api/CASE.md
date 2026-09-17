# Evidence that an endpoint works

Read this when what has to be proved is a request and its response: an endpoint that was added,
a status code that changed, a payload the reviewer has to see. Everything else about writing a
step script is in `references/writing-step-scripts.md`, and the panel the request runs in is
described in `references/terminal-in-the-page.md`.

The claim is made by calling the endpoint on screen, with the session the signed-in browser is
holding — not by quoting a request and a response the reviewer would have to take on trust.

```js
const req = await api.from(page);

mark('POST /api/orders returns 201');
await req.curl('POST', '/api/orders', { json: { sku: 'ABC', qty: 2 }, expect: 201 });
await shot('order-created');
await term.close();
```

`req.curl` opens the panel when it is not open already and leaves it open, the same way `term.run`
does. Close it once the requests are done, or it covers the bottom of the page for the rest of the
take — and take the screenshot before closing, because the answer goes with the panel.

What the panel shows is one curl line and its answer:

```
$ curl -sS -X POST "https://app.example.com/api/orders" -H 'Content-Type: application/json' \
    -b /tmp/evidence-session-8QhT1a/cookies.txt -d '{"sku":"ABC","qty":2}' \
    -w '%{stderr}HTTP %{http_code} in %{time_total}s\n' | jq
HTTP 201 in 0.184s
{
  "id": 4102,
  "status": "pending"
}
```

## The two calls

| Call | What it does |
|---|---|
| `api.from(page)` | Takes the cookies the page's origin holds, writes them where curl can read them, registers every value as a secret, and answers with the request helper |
| `req.curl(method, path, options)` | Builds one curl line, runs it in the panel, and throws when the status is not the one asserted |

`api.from` takes a bearer token as well, when the session is one:

```js
const req = await api.from(page, { token: (p) => p.evaluate(() => localStorage.getItem('jwt')) });
```

A string is used as the token; a function is called with the page, so the token can be read out of
wherever the application keeps it. It never reaches the command line — curl is given a config file
instead, which is what `-K` is in the line.

| Option of `req.curl` | For |
|---|---|
| `json` | A request body. Sets the content type and sends it with `-d` |
| `query` | Query parameters, encoded into the URL |
| `headers` | Extra headers, one `-H` each |
| `expect` | The status this step asserts. Nothing else makes the take evidence |
| `jq` | A jq filter, for a response too long to sit through |
| `pause` | How long to hold on the answer, same vocabulary as a click |

It returns `{ status, output, command }`, and `req.jar` is the cookie file, in case the flow has a
reason to show it.

## `expect` is the assertion

The status is written to standard error by curl itself, so it is on screen whether or not the body
goes through `jq`, and the runbook records what was asserted beside the command. Without `expect`
the take is a recording of a command that ran; with it, the take fails on the spot when the answer
changes, and the runbook says what it was holding the endpoint to.

Assert the status the merge request claims, not the one that happens to come back.

The response body is not in the runbook — only the command, what it asserted and its exit code. The
video is where the body survives, so hold on it long enough to be found: `pause: 4000` on the
request that carries the result, rather than the default beat after a command.

## What a request costs in screen time

The command is typed at the speed a person types. A plain request runs to about a hundred and sixty
characters — some ten seconds of video before the answer appears — and a `jq` filter of any
substance takes it past two hundred and fifty, which is nearer twenty.

That cuts against the advice below it, and knowingly: shortening a long response lengthens the
command that shortens it. The trade is still worth making, because a filtered response is read in
one frame while an unfiltered one scrolls for half the take — but it is a trade, not a saving.
Write the shortest filter that answers the question, not the one that shows everything interesting.

Plan the flow around it. Two or three requests are a recording; ten are a script — write the file,
show it once with `term.script()`, and let the run prove the lot.

## A response longer than the panel

Every line of an output is revealed, which for a hundred-line payload is most of the take — and the
runner says so on stdout when it happens. Cut it down in the request rather than recording it
whole:

```js
await req.curl('GET', '/api/orders', { query: { page: 1 }, expect: 200, jq: '.orders[0:3]' });
```

On a machine with no `jq` the pipe is left off the line entirely and the response is shown as it
came back. Nothing stands in for `jq`: a line nobody would have typed is not a line to put in
evidence.

## What this case will not do

- **Put the session on the command line.** The cookies go to a file outside the project, and the
  bearer token to a config file; both are registered as secrets before the first command is typed,
  so anything that echoes one back is blacked out in the panel, the runbook and the screenshots.
  There is no option to turn that off.
- **Build the request from anything but the browser's own session.** A request made as nobody in
  particular proves nothing about what a signed-in user can do.
- **Stand in for the page.** If the change is visible on a screen, record the screen. This is for
  the part that is not.
