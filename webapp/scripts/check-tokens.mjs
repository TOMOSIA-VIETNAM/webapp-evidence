#!/usr/bin/env node
// Fails when a page or component carries a raw style value instead of a token.
// Colour and length literals belong in src/styles/tokens.css and nowhere else.

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SCANNED = ['src/pages', 'src/components', 'src/layouts']

const RULES = [
  // A short all-digit `#123` is an issue or pull request number, not a colour; six or eight
  // digits, or any length carrying a letter, is a colour.
  { name: 'hex colour', re: /#(?:[0-9a-fA-F]{6}(?:[0-9a-fA-F]{2})?|[0-9a-fA-F]*[a-fA-F][0-9a-fA-F]*)\b/g },
  { name: 'rgb()/hsl() colour', re: /\b(?:rgba?|hsla?)\(/g },
  { name: 'pixel length', re: /\b\d+(?:\.\d+)?px\b/g },
]

// Inline SVG carries its own geometry, and the `sizes`/`srcset` attributes take plain
// media queries the browser reads before any CSS variable exists. Neither styles the page.
const IGNORED_LINE =
  /<(svg|path|circle|rect|g|use|line|polygon|polyline|ellipse)\b|viewBox=|stroke-width=|\bsizes=|\bsrcset=|transform-origin:/

function* walk(dir) {
  let entries
  try {
    entries = readdirSync(dir)
  } catch {
    return
  }
  for (const entry of entries) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) yield* walk(full)
    else if (/\.(astro|ts|tsx|css)$/.test(entry)) yield full
  }
}

const findings = []
for (const base of SCANNED) {
  for (const file of walk(join(repoRoot, base))) {
    const lines = readFileSync(file, 'utf8').split('\n')
    lines.forEach((line, i) => {
      if (IGNORED_LINE.test(line)) return
      for (const rule of RULES) {
        rule.re.lastIndex = 0
        const hit = rule.re.exec(line)
        if (hit) findings.push(`${relative(repoRoot, file)}:${i + 1}  ${rule.name}: ${hit[0]}`)
      }
    })
  }
}

if (findings.length) {
  console.error('raw style values found — move them into src/styles/tokens.css and use the token:')
  for (const f of findings) console.error(`  - ${f}`)
  process.exit(1)
}
console.log('token check ok — no raw colour or pixel literals outside tokens.css')
