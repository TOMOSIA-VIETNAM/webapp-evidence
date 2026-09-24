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

Nothing the page shows about the skill is typed twice. `scripts/sync-upstream.mjs` runs before
every dev, build and check and copies, into gitignored paths:

| from | used for |
|---|---|
| `docs/images/logo/` | the lockup in the nav, the favicon, and the firefly the hero animates — split into wings, body and lantern from `logo.svg` |
| `docs/demo/site-tour.gif` | the recording under How it works |
| `docs/demo/vision-sheet-*.png` | the contact sheets in the vision section |

`src/lib/upstream.ts` reads, at build time, the README's install blocks, its example request and
its runbook excerpt, the plugin name from `plugin.json`, and the skills under `src/skills/`. The
UAT report maps each acceptance criterion to runbook lines by the text they start with, so a
re-recorded demo that moves a timestamp fails the build instead of pointing at nothing. When that
happens, update the prefixes in `src/components/sections/Uat.astro`.

`public/og.png` is the one derived file that is committed: `pnpm og` redraws it after the mark or
the English headline changes.

## Deploy

A Vercel project with **Root Directory** set to `webapp`. The build reads files one level up, which
Vercel allows by default ("Include files outside the root directory in the Build Step"). Set
`SITE_URL` when the site is served from an origin other than `https://webapp-evidence.vercel.app`.
