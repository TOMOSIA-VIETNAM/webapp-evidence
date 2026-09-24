#!/usr/bin/env node
// Checks what a reader should get from the built page, against a running `pnpm preview`:
//   node scripts/check-ui.mjs [base-url]      (default http://localhost:4321)
//
// It asserts behaviour, not wording — every language is checked with the same selectors. What it
// covers breaks quietly while the markup still renders: a criterion that lights no runbook line,
// a demo that never loads, a phone that scrolls sideways, a page that needs script to be read.

import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { chromium } from 'playwright'

const BASE = process.argv[2] ?? 'http://localhost:4321'
const LOCALES = ['/', '/vi/', '/ja/', '/zh/']
const WIDTHS = [390, 768, 1280]
const axeSource = readFileSync(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8')

const failures = []
const check = (ok, message) => {
  if (!ok) failures.push(message)
}

const browser = await chromium.launch({ channel: 'chrome' })

for (const path of LOCALES) {
  for (const width of WIDTHS) {
    const page = await browser.newPage({ viewport: { width, height: 900 } })
    const errors = []
    page.on('pageerror', (error) => errors.push(String(error)))
    page.on('console', (message) => message.type() === 'error' && errors.push(message.text()))
    await page.goto(BASE + path, { waitUntil: 'networkidle' })

    // Scrolling sideways is what a reader notices, not what scrollWidth reports.
    const sideways = await page.evaluate(() => {
      window.scrollTo(9999, window.scrollY)
      const x = window.scrollX
      window.scrollTo(0, window.scrollY)
      return x
    })
    check(sideways === 0, `${path} @${width}: the page scrolls ${sideways}px sideways`)
    check(errors.length === 0, `${path} @${width}: page errors: ${errors.join(' | ')}`)
    await page.close()
  }
}

// Behaviour, checked once on the English page at desktop width.
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })

  // Each criterion lights exactly the runbook lines it names, and choosing it again clears them.
  for (const button of await page.locator('[data-criterion]').all()) {
    const expected = (await button.getAttribute('data-lines')).split(',').length
    await button.scrollIntoViewIfNeeded()
    await button.click()
    check((await button.getAttribute('aria-pressed')) === 'true', 'a chosen criterion is not marked pressed')
    const lit = await page.locator('[data-runbook] .is-proof').count()
    check(lit === expected, `criterion ${await button.getAttribute('data-criterion')} lit ${lit} lines, expected ${expected}`)
  }
  await page.keyboard.press('Escape')
  check((await page.locator('[data-runbook] .is-proof').count()) === 0, 'Escape leaves runbook lines marked')

  // The install tabs show one platform at a time, and every platform's panel has commands.
  const tabs = page.locator('[data-install-tab]')
  check((await tabs.count()) === 5, 'the install strip does not offer five platforms')
  for (let i = 0; i < (await tabs.count()); i++) {
    await tabs.nth(i).click()
    const visible = await page.locator('[data-install-panel]:visible').count()
    check(visible === 1, `install tab ${i}: ${visible} panels visible`)
    check((await page.locator('[data-install-panel]:visible code').count()) >= 3, `install tab ${i}: commands missing`)
  }

  // The recording downloads only once scrolled to, and then plays by itself.
  const video = page.locator('[data-demo-video]')
  check((await video.evaluate((v) => v.readyState)) === 0, 'the recording loaded before anyone scrolled to it')
  await video.scrollIntoViewIfNeeded()
  await page.waitForFunction(() => {
    const v = document.querySelector('[data-demo-video]')
    return v && !v.paused && v.currentTime > 0.5
  }, null, { timeout: 10000 }).catch(() => check(false, 'the recording did not start playing in view'))

  // Lazy images arrive once they are scrolled to.
  for (const selector of ['#vision img']) {
    const image = page.locator(selector).first()
    await image.scrollIntoViewIfNeeded()
    await image.evaluate((img) => (img.complete ? null : new Promise((resolve) => img.addEventListener('load', resolve))))
    check((await image.evaluate((img) => img.naturalWidth)) > 0, `${selector} never loaded`)
  }

  // Accessibility, on the whole page.
  await page.addScriptTag({ content: axeSource })
  const { violations } = await page.evaluate(() => window.axe.run(document, { resultTypes: ['violations'] }))
  for (const v of violations) check(false, `axe ${v.id}: ${v.help} (${v.nodes.length} nodes)`)
  await page.close()
}

// The page reads completely before, or without, its script.
{
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 1280, height: 900 } })
  const page = await context.newPage()
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  const panels = await page.locator('[data-install-panel]:visible').count()
  check(panels === 5, `without script, ${panels} of 5 install panels are visible`)
  check((await page.locator('[data-runbook] li:visible').count()) > 5, 'without script, the runbook is hidden')
  await context.close()
}

await browser.close()

if (failures.length) {
  console.error('check-ui failed:')
  for (const f of failures) console.error(`  - ${f}`)
  process.exit(1)
}
console.log(`check-ui ok — ${LOCALES.length} languages x ${WIDTHS.length} widths, behaviour, axe, no-script`)
