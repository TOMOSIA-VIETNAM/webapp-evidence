/*
 * The product's name as a brand — the words in the logo, "Webapp Evidence" — read from the logo
 * itself at build time, so the page, its metadata and the lockup cannot disagree. Commands and
 * packages keep the handle `webapp-evidence` (src/lib/upstream.ts, PLUGIN).
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const lockup = readFileSync(resolve(process.cwd(), '../docs/images/logo/logo-lockup.svg'), 'utf8')
const label = lockup.match(/aria-label="([^"]+)"/)?.[1]
if (!label) throw new Error('docs/images/logo/logo-lockup.svg carries no aria-label naming the product')

export const BRAND = label
