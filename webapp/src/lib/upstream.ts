/*
 * Facts this page quotes from the repository it sits in, read at build time. The install commands,
 * the example flow and the runbook excerpt are the README's own blocks; the command a user types is
 * derived the way the installer derives it. Nothing here is retyped, so the page cannot drift from
 * what a user actually installs.
 *
 * Every lookup throws when it finds nothing: a README reorganised under this page fails the build
 * rather than shipping a page with an empty install box.
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'

/** The repository root. Astro runs from this site's own directory, which sits one level down. */
const REPO = resolve(process.cwd(), '..')

const read = (path: string) => readFileSync(join(REPO, path), 'utf8')

const README = read('README.md')

/**
 * The body of the first fenced block of `lang` after `marker`, before the next `## ` heading. A
 * `## ` line inside a fence — the runbook excerpt is full of them — is code, not a heading.
 */
function blockAfter(marker: string, lang: string): string {
  const start = README.indexOf(marker)
  if (start < 0) throw new Error(`README.md: "${marker}" not found`)
  const after = README.slice(start + marker.length).split('\n')

  for (let i = 0; i < after.length; i++) {
    const line = after[i]
    if (line.startsWith('## ')) break
    if (!line.startsWith('```')) continue
    const close = after.indexOf('```', i + 1)
    if (close < 0) break
    if (line === '```' + lang) return after.slice(i + 1, close).join('\n')
    // Some other block: step over it whole, so its content is never read as a heading.
    i = close
  }
  throw new Error(`README.md: no \`\`\`${lang} block under "${marker}"`)
}

const lines = (block: string) => block.split('\n').filter((line) => line.trim() !== '')

/** The two commands that install the plugin in Claude Code. */
export const CLAUDE_INSTALL = lines(blockAfter('**Claude Code**', 'bash'))

/** The one-liner every other platform installs with. */
export const ONE_LINER = lines(blockAfter('**Cursor, Codex, Gemini CLI, Antigravity**', 'bash'))[0]

/** The full-stack request the README uses to show one take proving screen, endpoint and database. */
export const EXAMPLE_REQUEST = blockAfter('## What one take proves', '')

/** The runbook excerpt the README quotes, produced by docs/demo/record.sh on a real take. */
export const RUNBOOK_EXCERPT = blockAfter('## What comes back', 'markdown')

/** The line of the excerpt that starts with `prefix`, so a section can point at it by timestamp. */
export function runbookLine(prefix: string): number {
  const index = RUNBOOK_EXCERPT.split('\n').findIndex((line) => line.startsWith(prefix))
  if (index < 0) throw new Error(`README.md runbook excerpt: no line starting with "${prefix}"`)
  return index
}

/** The plugin as a user installs it, from the manifest every platform reads. */
export const PLUGIN = JSON.parse(read('plugin.json')).name as string

/** Skill directories, the half of each command that Claude Code puts after the plugin name. */
const SKILLS_DIR = join(REPO, 'src/skills')
export const SKILLS = readdirSync(SKILLS_DIR).filter((dir) => existsSync(join(SKILLS_DIR, dir, 'SKILL.md')))

if (!SKILLS.includes('recording')) throw new Error('src/skills/recording/SKILL.md not found')

/*
 * What a user types to run a skill on each platform. Claude Code namespaces skills by plugin; the
 * other four install each one under `<plugin>-<skill>`, and Codex invokes with `$` instead of `/`.
 */
export function commandFor(platform: Platform, skill: string): string {
  if (platform === 'Claude Code') return `/${PLUGIN}:${skill}`
  if (platform === 'Codex') return `$${PLUGIN}-${skill}`
  return `/${PLUGIN}-${skill}`
}

export const PLATFORMS = ['Claude Code', 'Cursor', 'Codex', 'Gemini CLI', 'Antigravity'] as const
export type Platform = (typeof PLATFORMS)[number]

/** How each platform installs: Claude Code through its marketplace, the rest through the one-liner. */
export const installFor = (platform: Platform): readonly string[] =>
  platform === 'Claude Code' ? CLAUDE_INSTALL : [ONE_LINER]
