# webapp-evidence site

A static landing page for the skill in the directory above. `README.md` covers running, content
sources and deploying; this is what changes break.

## Stack, fixed

Astro 5 (static), Tailwind CSS v4 with `@theme` in `src/styles/tokens.css`, GSAP + ScrollTrigger and
Lenis for motion, `@lucide/astro` icons, Inter self-hosted, pnpm. No UI-framework island, no
analytics, nothing fetched from another origin at runtime.

It shares its visual system with the open-pr landing page — frosted glass tiers over slow blobs,
warm sand neutrals, 300–600ms iOS easing, light theme only — with the firefly's lime in place of
open-pr's orange. The accent is `firefly-800`, not the brand mid tone: white text on the mid tone
reads at 3.9:1.

## Hard edges

- **Tokens only.** Colour, length, radius, shadow and duration come from `tokens.css`.
  `scripts/check-tokens.mjs` fails on a hex, `rgb(` or `px` in `src/components`, `src/pages` or
  `src/layouts`.
- **Every visible string is in `src/i18n/`.** `Dictionary` is typed from `en.ts`, so a key missing
  from, or extra in, another language fails `astro check`. Commands, file names and PASS stay English.
- **Never retype the skill.** Install commands, the example request, the runbook excerpt and the
  command names come from `src/lib/upstream.ts`; the logo and demo media from
  `scripts/sync-upstream.mjs`. A missing source fails the build on purpose.
- **Motion goes through `src/lib/motion.ts`** and the pointer glow through `src/lib/glow.ts`. Each
  preset leaves the final state in place under `prefers-reduced-motion`; no section pins or
  scrubs the scroll.
- **The page works before its script.** Tabs render every panel and the language menu falls back to
  links; never use `hidden` on what script is meant to reveal.
- **A section clips its own spill.** `Section.astro` carries `overflow-x-clip` so decorative washes
  cannot make a phone scroll sideways; a full-bleed section outside it needs its own.

## Done means

`pnpm check`, `pnpm build` and `pnpm check:ui` against `pnpm preview`, all green, and screenshots at
390, 768 and 1280px looked at — not described.
