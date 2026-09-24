#!/usr/bin/env node
// Draws what the site shows outside its own page, from the brand files and the dictionaries:
//   public/og/<locale>.png   the 1200x630 card a link unfurls into, one per language
//   public/icon/*.png        home-screen and search-result icons, from the firefly mark
//   pnpm social
//
// Run by hand when the logo, the headline or a dictionary line on the card changes, then commit the
// images and bump OG_VERSION in src/lib/site.ts — chat apps and crawlers cache a card by its URL.
// Not part of the build: the card sets text, and a build machine without these fonts would draw it
// in whatever fallback it has.

import { mkdirSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { en } from '../src/i18n/en.ts'
import { vi } from '../src/i18n/vi.ts'
import { ja } from '../src/i18n/ja.ts'
import { zh } from '../src/i18n/zh.ts'
import { PLATFORMS, commandFor } from '../src/lib/upstream.ts'

const site = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const logo = (file) => readFileSync(join(site, '..', 'docs/images/logo', file), 'utf8').replace(/<\?xml[^>]*>/, '')

// The page's own tokens, read from tokens.css so the card cannot drift from the site.
const tokens = readFileSync(join(site, 'src/styles/tokens.css'), 'utf8')
const token = (name) => tokens.match(new RegExp(`--color-${name}:\\s*(#[0-9a-f]{6})`, 'i'))[1]
const C = Object.fromEntries(
  ['sand-50', 'sand-950', 'sand-700', 'sand-600', 'firefly-100', 'firefly-200', 'firefly-300', 'firefly-500', 'firefly-800'].map((n) => [n, token(n)]),
)

// Latin first, then the system faces that carry Japanese and Chinese on the machine drawing it.
const SANS = "Inter, 'SF Pro Display', 'Helvetica Neue', 'Hiragino Sans', 'PingFang SC', 'Hiragino Sans GB', sans-serif"
const MONO = "'SF Mono', Menlo, monospace"
const escape = (text) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;')

// A nested <svg> keeps the brand file's own viewBox, so the logo is placed as shipped.
const place = (file, x, y, width, height) =>
  logo(file).replace('<svg ', `<svg x="${x}" y="${y}" width="${width}" height="${height}" `)

function card(dict) {
  // The headline is two short clauses; the card breaks it where the page does, after the comma.
  const [first, second] = dict['hero.headline'].split(/(?<=[,，、])\s*/)
  // Chips laid out left to right; a CJK-free estimate of width is enough for these Latin names.
  let x = 80
  const chips = PLATFORMS.map((name) => {
    const width = name.length * 11 + 36
    const chip = `<rect x="${x}" y="468" width="${width}" height="40" rx="20" fill="${C['firefly-100']}"/>
      <text x="${x + width / 2}" y="494" font-size="19" text-anchor="middle" fill="${C['firefly-800']}" font-family="${SANS}">${name}</text>`
    x += width + 10
    return chip
  }).join('')

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs><filter id="blur" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="90"/></filter></defs>
  <rect width="1200" height="630" fill="${C['sand-50']}"/>
  <circle cx="120" cy="40" r="260" fill="${C['firefly-300']}" opacity="0.5" filter="url(#blur)"/>
  <circle cx="1010" cy="400" r="300" fill="${C['firefly-200']}" opacity="0.85" filter="url(#blur)"/>
  ${place('logo-lockup.svg', 66, 44, 459, 110)}
  <g font-family="${SANS}" font-weight="600" fill="${C['sand-950']}" letter-spacing="-1.5">
    <text x="80" y="280" font-size="68">${escape(first)}</text>
    <text x="80" y="362" font-size="68">${escape(second ?? '')}</text>
  </g>
  <text x="80" y="428" font-size="26" fill="${C['sand-700']}" font-family="${SANS}">${escape(dict['og.tagline'])}</text>
  ${chips}
  <text x="80" y="570" font-size="26" fill="${C['firefly-800']}" font-family="${MONO}">${escape(commandFor('Claude Code', 'recording'))}</text>
  <circle cx="1000" cy="360" r="150" fill="none" stroke="${C['firefly-500']}" stroke-opacity="0.35" stroke-width="2"/>
  <circle cx="1000" cy="360" r="205" fill="none" stroke="${C['firefly-500']}" stroke-opacity="0.18" stroke-width="2"/>
  ${place('logo.svg', 820, 170, 360, 360)}
</svg>`
}

mkdirSync(join(site, 'public/og'), { recursive: true })
for (const [locale, dict] of Object.entries({ en, vi, ja, zh })) {
  await sharp(Buffer.from(card(dict))).png({ compressionLevel: 9 }).toFile(join(site, `public/og/${locale}.png`))
}

// Icons: the mark on the page's paper, padded the way launchers crop — a square with room around it.
mkdirSync(join(site, 'public/icon'), { recursive: true })
const icon = (size) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 128 128">
  <rect width="128" height="128" fill="${C['sand-50']}"/>${place('logo.svg', 14, 14, 100, 100)}</svg>`
for (const [file, size] of [['apple-touch-icon.png', 180], ['icon-192.png', 192], ['icon-512.png', 512], ['favicon-48.png', 48]]) {
  await sharp(Buffer.from(icon(size))).png().toFile(join(site, 'public/icon', file))
}
console.log('build-social: public/og/{en,vi,ja,zh}.png and public/icon/*.png written')
