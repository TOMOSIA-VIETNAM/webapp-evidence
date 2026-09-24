#!/usr/bin/env node
// Draws the 1200x630 social card into public/og.png from the firefly mark and the English headline.
//   pnpm og
//
// Run by hand when the mark or the headline changes, then commit the image. It is not part of the
// build because the headline is set in text, and a build machine without the font would draw it in
// whatever fallback it has.

import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { en } from '../src/i18n/en.ts'

const site = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const mark = readFileSync(join(site, '..', 'docs/images/logo/logo.svg'), 'utf8')
const plugin = JSON.parse(readFileSync(join(site, '..', 'plugin.json'), 'utf8')).name
const polygons = mark.match(/<polygon[^>]*\/>/g).join('')

// The page's own tokens, read from tokens.css so the card cannot drift from the site.
const tokens = readFileSync(join(site, 'src/styles/tokens.css'), 'utf8')
const token = (name) => tokens.match(new RegExp(`--color-${name}:\\s*(#[0-9a-f]{6})`, 'i'))[1]
const [paper, ink, muted, glow, pale, accent] = ['sand-50', 'sand-950', 'sand-700', 'firefly-300', 'firefly-200', 'firefly-800'].map(token)

const escape = (text) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;')
const [line1, line2] = en['hero.headline'].split(', ')

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs><filter id="blur" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="90"/></filter></defs>
  <rect width="1200" height="630" fill="${paper}"/>
  <circle cx="140" cy="80" r="260" fill="${glow}" opacity="0.55" filter="url(#blur)"/>
  <circle cx="1020" cy="520" r="280" fill="${pale}" opacity="0.8" filter="url(#blur)"/>
  <g transform="translate(820 150) scale(2.6)">${polygons}</g>
  <g font-family="Inter, 'Helvetica Neue', Arial, sans-serif">
    <text x="80" y="150" font-size="34" font-weight="600" fill="${accent}">${plugin}</text>
    <text x="80" y="270" font-size="72" font-weight="600" fill="${ink}" letter-spacing="-2">${escape(line1)},</text>
    <text x="80" y="355" font-size="72" font-weight="600" fill="${ink}" letter-spacing="-2">${escape(line2)}</text>
    <text x="80" y="450" font-size="28" fill="${muted}">${escape(en['hero.badge'])}</text>
    <text x="80" y="540" font-size="26" font-family="Menlo, monospace" fill="${accent}">/${plugin}:recording</text>
  </g>
</svg>`

await sharp(Buffer.from(svg)).png().toFile(join(site, 'public/og.png'))
console.log('build-og: public/og.png written')
