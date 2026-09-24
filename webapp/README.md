# webapp-evidence site

The landing page for webapp-evidence: one static page in English, Tiếng Việt, 日本語 and 简体中文,
built with Astro. It lives in this repository so it can quote the README, the brand and the demo
recording directly, and it never reaches a user's disk: `install.sh` sparse-checks out an include
list that does not name `webapp/`, and Claude Code's marketplace ships `src/` only.

## Run it

```bash
cd webapp
pnpm install
pnpm dev          # http://localhost:4321
pnpm check        # types, dictionary parity, no raw style values
pnpm build        # static output in dist/
pnpm preview      # then, in another shell: pnpm check:ui http://localhost:4321
```

`check:ui` drives the built page in Chrome: every language at 390, 768 and 1280px with no sideways
scroll and no page error, each acceptance criterion lighting its own runbook lines, the install
tabs, lazy media loading, axe, and the page read with script turned off.

## Where the content comes from

Nothing the page shows about the skill is typed twice.

**The skill.** `src/lib/upstream.ts` reads, at build time, the README's install blocks and its
example request, the plugin name from `plugin.json`, and the skills under `src/skills/`.
`scripts/sync-upstream.mjs` copies the logo from `docs/images/logo/` before every dev, build and
check, and splits the firefly into wings, body and lantern so the hero can move them.

**The recording.** The video under How it works is this page, recorded by the skill — the same
take the repository README shows:

```bash
docs/demo/record.sh                                    # a fresh build on a local preview
BASE_URL=https://evd.vercel.app docs/demo/record.sh    # the deployment
```

It follows `docs/demo/tour-steps.js` and writes everything into `docs/demo/`: the README's gif, the
web copy and its poster, the vision contact sheets, and three sections of the runbook.
`scripts/sync-upstream.mjs` copies the media in and `src/lib/demo.ts` reads the rest. The UAT report
finds each criterion's proof by the step label passed to `mark()`, so a re-recorded take moves the
timestamps without breaking anything, and a renamed step fails the build.

Re-record after changing what the page looks like: the take shows the page as it was built.

`public/og.png` is the one derived file that is committed: `pnpm og` redraws it after the mark or
the English headline changes.

## Deploy

A Vercel project with **Root Directory** set to `webapp`. The build reads files one level up, which
Vercel allows by default ("Include files outside the root directory in the Build Step"). Set
`SITE_URL` when the site is served from an origin other than `https://evd.vercel.app`.
