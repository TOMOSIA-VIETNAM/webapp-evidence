#!/usr/bin/env node
// Copies what this site shows from the repository it sits in, so nothing is redrawn or retyped by
// hand. The originals stay where they are — docs/images/logo/ for the brand, docs/demo/ for the
// recording and its contact sheets — and the copies are gitignored.
//
// It also splits the firefly mark into its parts (the two wings, the body, the lantern and its
// light) so the page can move them, without a second hand-drawn copy of the geometry.
//
// Runs before dev, build and check. Fails loudly when a source is missing: a page built without its
// logo or its demo is worse than no build.

import { copyFileSync, mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const site = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const repo = resolve(site, '..')

const COPIES = [
  ['docs/images/logo/logo-lockup.svg', 'src/assets/upstream/brand/logo-lockup.svg'],
  ['docs/images/logo/logo.svg', 'src/assets/upstream/brand/logo.svg'],
  ['docs/images/logo/favicon.svg', 'public/favicon.svg'],
  // The gif is served as-is: an image pipeline would flatten it to its first frame.
  ['docs/demo/site-tour.gif', 'public/upstream/site-tour.gif'],
  ['docs/demo/vision-sheet-01.png', 'src/assets/upstream/demo/vision-sheet-01.png'],
  ['docs/demo/vision-sheet-02.png', 'src/assets/upstream/demo/vision-sheet-02.png'],
  ['docs/demo/vision-sheet-03.png', 'src/assets/upstream/demo/vision-sheet-03.png'],
]

const missing = COPIES.map(([from]) => from).filter((from) => !existsSync(join(repo, from)))
if (missing.length) {
  console.error(`sync-upstream: these sources are gone from the repository:\n  ${missing.join('\n  ')}`)
  process.exit(1)
}

for (const [from, to] of COPIES) {
  mkdirSync(dirname(join(site, to)), { recursive: true })
  copyFileSync(join(repo, from), join(site, to))
}

// The mark is symmetric about x = 64 in a 128-unit box. A polygon drawn in the palest tone is the
// lantern or a ray of its light; one sitting wholly to a side of the body is part of a wing.
const WING_EDGE = { left: 40, right: 88 }

const svg = readFileSync(join(repo, 'docs/images/logo/logo.svg'), 'utf8')
const viewBox = svg.match(/viewBox="([^"]+)"/)?.[1]
const polygons = [...svg.matchAll(/<polygon points="([^"]+)" fill="(#[0-9A-Fa-f]{6})"\s*\/>/g)].map((m) => ({
  points: m[1],
  fill: m[2].toUpperCase(),
}))
if (!viewBox || polygons.length === 0) {
  console.error('sync-upstream: docs/images/logo/logo.svg no longer reads as flat polygons')
  process.exit(1)
}

// The palest tone is the one with the highest sum of channels.
const brightness = (hex) => [1, 3, 5].reduce((sum, i) => sum + parseInt(hex.slice(i, i + 2), 16), 0)
const palest = polygons.map((p) => p.fill).reduce((a, b) => (brightness(b) > brightness(a) ? b : a))

const centreX = (points) => {
  const xs = points.split(' ').map((pair) => Number(pair.split(',')[0]))
  return xs.reduce((a, b) => a + b, 0) / xs.length
}

const parts = { left: [], right: [], body: [], light: [] }
for (const polygon of polygons) {
  const x = centreX(polygon.points)
  if (polygon.fill === palest) parts.light.push(polygon)
  else if (x < WING_EDGE.left) parts.left.push(polygon)
  else if (x > WING_EDGE.right) parts.right.push(polygon)
  else parts.body.push(polygon)
}
if (Object.values(parts).some((list) => list.length === 0)) {
  console.error('sync-upstream: could not find both wings, the body and the lantern in logo.svg')
  process.exit(1)
}

writeFileSync(join(site, 'src/assets/upstream/firefly.json'), `${JSON.stringify({ viewBox, parts }, null, 2)}\n`)
console.log(`sync-upstream: ${COPIES.length} files copied, firefly split into ${polygons.length} polygons`)
