# Cases — build order

Spec: `backlogs/evidence-cases/spec.md`.

The frame comes first and the `api` case is built on it, so the second case costs a directory. Each
task leaves `node --test 'tests/*.test.js'` green.

---

## 1. The loader — `scripts/cases.js`

`loadCases(dir)` reads every subdirectory of `cases/`, requires its `index.js`, and returns the
list. A directory missing `index.js` or `CASE.md`, or one whose `name` does not match its
directory, fails the run with a message naming the directory — the same failure shape the skill
already uses for a case where silence would be worse than stopping.

`applyCases(cases, runtime)` calls each case's `helpers(runtime)` and merges the results into one
object, refusing two cases that export the same helper name.

`runtime` is fixed and small: `{ page, term, root, registerSecret, outDir }`.

**Done when** `tests/cases.test.js` covers a well-formed case, a directory missing each of the two
files, a name that does not match its directory, and two cases colliding on a helper name.

## 2. Wiring — `scripts/record.js`

`buildContext` merges the case helpers into the scope it returns, beside `click`, `term` and the
rest. `registerSecret` appends to the same list the account password already goes through, so a
value registered by a case is scrubbed everywhere the password is.

**Done when** `tests/record.test.js` shows a helper from a case reaching a step script, and a
secret a case registers being scrubbed out of the panel text and the runbook.

## 3. `cases/api/index.js`

- `api.from(page, { token })` — collects the cookies for the page's origin, writes a jar in the
  system temp directory, registers every cookie value and the token as secrets, detects `jq`, and
  returns `req`.
- `req.curl(method, path, { json, headers, query, expect })` — builds one `curl` line, runs it
  through `term.run`, and throws when `expect` does not match the status. The failure message
  quotes the status line and the first lines of the body.
- `req.jar` — the path, so a step script can show it if the flow needs to.

The command it builds is the one a person would type: `-sS`, the cookie jar, the body, the status
written to standard error, piped to `jq` when it exists.

**Done when** `tests/api-case.test.js` covers the command built for each of GET with a query, POST
with a body, an `expect` that matches and one that does not, a machine without `jq`, and shows that
no cookie value appears in the built command line.

## 4. `cases/api/CASE.md`

What the agent reads when the evidence is an endpoint. When to use the case; that the request must
be the one the signed-in user makes; that a response too long to scroll is cut down with `jq`
rather than recorded whole; that `expect` is what makes it evidence rather than a log.

## 5. `term.script(path)` — `scripts/terminal.js`

Writes the file before the panel opens, then shows `cat` and the run inside it. Refuses a path
inside the skill directory, as the runner already does for everything else.

**Done when** `tests/terminal.test.js` covers the file being written, both commands reaching the
panel, and the refusal.

## 6. Routing in `SKILL.md`

One table, one row for `api`, in the reference section that already tells the agent what to read
and when. Plus the rule from the spec in one line: type a single command, write a file only when
the setup needs one.

## 7. Drift test — `tests/platform-layer.test.js`

Every directory under `cases/` has `CASE.md` and `index.js` and appears in the `SKILL.md` table;
every row in the table points at a directory that exists.

**Done when** removing a row from the table fails the suite.

## 8. The demo take proves it

A step script against the e2e app calling one endpoint and asserting its status.

**Done when** `./tests/e2e/run.sh` passes and the video shows the request and the response.
