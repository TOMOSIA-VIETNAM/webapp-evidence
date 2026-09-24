/*
 * The take this site shows of itself — recorded by demo/record.sh with this repository's runner —
 * read at build time. The take's name and its first screenshot come from the step script, the
 * quoted runbook from what the recording wrote, so nothing here is retyped from a take.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createRequire } from 'node:module'

const SITE = process.cwd()
const STEPS_FILE = join(SITE, 'demo/tour-steps.cjs')

/** The take's name, which names its video and its runbook. */
export const DEMO_TAKE: string = createRequire(import.meta.url)(STEPS_FILE).name

/** The first screenshot the take writes; the runner numbers them in capture order. */
const firstShot = readFileSync(STEPS_FILE, 'utf8').match(/shot\('([^']+)'\)/)?.[1]
if (!firstShot) throw new Error('demo/tour-steps.cjs takes no screenshot')
export const DEMO_FIRST_SHOT = `01-${firstShot}.png`

/** The web copy of the take and its first frame, served from public/demo/. */
export const DEMO_VIDEO = `/demo/${DEMO_TAKE}.mp4`
export const DEMO_POSTER = `/demo/${DEMO_TAKE}-poster.jpg`

/** The sections of the take's runbook the page quotes, copied line for line by demo/record.sh. */
export const RUNBOOK_EXCERPT = readFileSync(join(SITE, `src/data/${DEMO_TAKE}-runbook.md`), 'utf8').trimEnd()

/** The line of the excerpt that holds `text` — a step label passed to mark(), or a command. */
export function runbookLine(text: string): number {
  const index = RUNBOOK_EXCERPT.split('\n').findIndex((line) => line.includes(text))
  if (index < 0) throw new Error(`${DEMO_TAKE} runbook: no line holding "${text}" — re-recorded with a step renamed?`)
  return index
}
