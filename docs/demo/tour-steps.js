// The recording in the README and on the site: a tour of the project's own landing page, recorded
// by the tool the page advertises. The command the page shows is copied, the terminal panel reads
// back the SEO meta the page serves, and then the page is walked down using what each section does
// — the UAT report picked criterion by criterion, the proof layers, the feature cards, the install
// tabs — before the flight back to the top and every language the site ships.
//
// The `mark()` labels are load-bearing: the site's UAT report finds its proof in the runbook by
// these labels (webapp/src/components/sections/Uat.astro), and docs/demo/record.sh cuts the web
// copy and the gif between them. Rename one and follow it there.
//
// Selectors are the page's own data attributes. Re-record with docs/demo/record.sh.

// How far one turn of the wheel carries. The site smooths the wheel itself, easing towards the sum
// of the deltas it has been given — measured on this page, one pixel of delta is one pixel of
// scroll — so adding the deltas up says exactly where the page will come to rest.
const WHEEL_STEP = 380;

// Waits until the page has actually stopped moving. Lenis eases out over about a second, and every
// measurement taken before it settles is a measurement of where the page no longer is.
async function settleScroll(page, sleep, timeoutMs = 2500) {
  let previous = null;
  for (let waited = 0; waited < timeoutMs; waited += 120) {
    const y = await page.evaluate(() => window.scrollY);
    if (y === previous) return y;
    previous = y;
    await sleep(120);
  }
  return previous;
}

// Where the page should come to rest for a section: a section that fits the frame is centred in
// what is left below the fixed header, so the viewer gets the whole of it rather than its top edge
// and the tail of whatever came before. A section taller than the frame has its top put under the
// header instead, because that is the only part of it that can be framed at all.
//
// The header's height is read from the page rather than assumed: a number written into the step
// script is a number that goes stale the day the header changes.
async function restingPositionFor(page, selector) {
  return page.evaluate((sel) => {
    const element = document.querySelector(sel);
    if (!element) return null;
    const rect = element.getBoundingClientRect();
    const styles = getComputedStyle(element);
    // The sections carry their own vertical padding, and framing that padding rather than the
    // content is what leaves a section looking half-arrived with empty space above it.
    const paddingTop = parseFloat(styles.paddingTop) || 0;
    const paddingBottom = parseFloat(styles.paddingBottom) || 0;
    const contentTop = window.scrollY + rect.top + paddingTop;
    const contentHeight = rect.height - paddingTop - paddingBottom;

    const root = getComputedStyle(document.documentElement);
    const rootFontSize = parseFloat(root.fontSize) || 16;
    const headerRem = parseFloat(root.getPropertyValue('--nav-height'));
    const clearance = (Number.isFinite(headerRem) ? headerRem * rootFontSize : 64) + 24;
    const room = window.innerHeight - clearance;

    const offset = contentHeight <= room ? clearance + (room - contentHeight) / 2 : clearance;
    return Math.max(0, contentTop - offset);
  }, selector);
}

// Scrolls the page the way a reader does — with the wheel, in steps, leaving the pointer where it
// is — until `selector` is framed the way restingPositionFor decided.
//
// The position is tracked by adding up the wheel deltas rather than by re-measuring the element
// between turns: while the page is still easing, a fresh measurement reports a distance that the
// easing is already covering, and correcting for it is exactly what makes the page overshoot and
// jerk back. Summing the deltas needs no correction at all, so the wheel only ever turns one way.
//
// All of this lives here because the runner has no scroll helper of its own yet. Two enhancements
// are open for exactly that — TOMOSIA-VIETNAM/webapp-evidence#28 for the helper and #29 for where
// it should come to rest — and when they land, everything from WHEEL_STEP down to here goes.
async function scrollTo(page, sleep, selector) {
  const from = await settleScroll(page, sleep);
  const to = await restingPositionFor(page, selector);
  if (to === null) throw new Error(`Nothing to scroll to: ${selector} is not on the page`);

  const direction = Math.sign(to - from);
  if (direction === 0) return;

  let planned = from;
  while ((to - planned) * direction > 1) {
    const remaining = (to - planned) * direction;
    const step = Math.min(WHEEL_STEP, remaining);
    await page.mouse.wheel(0, step * direction);
    planned += step * direction;
    await sleep(55);
  }
  await settleScroll(page, sleep);
}

// Decorative elements — the mascot, the cards — have no role and no accessible name, so the
// pointer goes to their box rather than to a named locator. The hold is what makes the hover
// visible: the light under the cursor takes a moment to warm up.
async function hover(page, moveTo, sleep, locator, hold = 1100) {
  const box = await locator.boundingBox();
  if (!box) throw new Error('Nothing to hover: the element has no box on screen');
  await moveTo(box.x + box.width / 2, box.y + box.height / 2, Math.min(box.width, box.height));
  await sleep(hold);
}

// Opens the language menu and picks one. Choosing navigates, so the page comes back at the top.
async function chooseLanguage(page, click, sleep, locale, { pause = 'observe' } = {}) {
  await click(page.locator('[data-lang-trigger]').first(), { pause: 'quick' });
  await click(page.locator(`[data-set-lang="${locale}"]`).first(), { pause });
  await sleep(900);
}

// The copy buttons say "Copied" for 1.6s and then go back, so the state has to be read while it is
// still up — and read at all, because a blocked clipboard leaves the label untouched and the video
// would show a click that proved nothing.
async function copyAndCheck(page, click, sleep, button) {
  await click(button, { pause: 500 });
  const label = await button.locator('[data-copy-label]').innerText();
  const expected = await button.getAttribute('data-label-copied');
  if (label.trim() !== expected.trim()) {
    throw new Error(`The copy button still reads "${label}" — the clipboard write did not go through`);
  }
  await sleep(300);
}

module.exports = {
  app: 'site',
  name: 'evd-tour',
  start: '/',

  async run({ page, mark, click, note, shot, sleep, moveTo, term }) {
    const origin = new URL(page.url()).origin;
    // Chrome refuses navigator.clipboard.writeText without this, and the copy buttons hang on it.
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write'], { origin });

    // Cut to one screen wide so every line stays readable inside the terminal panel.
    const seoCommand =
      `curl -s ${origin}/ | ` +
      "grep -oE '<title>[^<]*</title>|<meta[^>]*(name=\"description\"|property=\"og:(title|url|image)\")[^>]*>' | " +
      'cut -c1-100';

    mark('Hero — the page as it opens');
    await sleep(1800);
    await shot('hero');

    mark('Hero — the firefly answers the pointer');
    await hover(page, moveTo, sleep, page.locator('[data-hero-mascot]'), 1500);
    await shot('hero-firefly');

    mark('Hero — copy the command that starts a recording');
    await copyAndCheck(page, click, sleep, page.locator('[data-copy-button]').first());
    await shot('hero-copied');

    mark('Terminal — the SEO meta the page serves, read off its URL');
    await term.open();
    await term.run(seoCommand, { pause: 'observe' });
    await note('The terminal runs against the URL being recorded, so these tags are what the page serves right now.');
    await shot('seo-meta');
    await term.close();

    mark('UAT — the four steps light up under the pointer');
    await scrollTo(page, sleep, '#uat');
    for (const index of [0, 1, 2, 3]) {
      await hover(page, moveTo, sleep, page.locator('[data-uat-step]').nth(index), 800);
    }
    await shot('uat-steps');

    mark('UAT report — each criterion picks out the runbook lines that prove it');
    await scrollTo(page, sleep, '[data-uat-report]');
    const criteria = page.locator('[data-criterion]');
    for (let i = 0; i < (await criteria.count()); i++) {
      await click(criteria.nth(i), { pause: 'observe' });
      await shot(`uat-criterion-${i + 1}`);
    }
    await click(page.locator('[data-criterion-reset]'), { pause: 'quick' });

    mark('How it works — three steps and the recording they produce');
    await scrollTo(page, sleep, '#how-it-works');
    for (const index of [0, 1, 2]) {
      await hover(page, moveTo, sleep, page.locator('[data-how-step]').nth(index), 700);
    }
    await shot('how-it-works');

    mark('Full-stack proof — the screen, the endpoint and the database');
    await scrollTo(page, sleep, '#proof');
    for (const index of [0, 1, 2]) {
      await hover(page, moveTo, sleep, page.locator('[data-proof-layer]').nth(index), 800);
    }
    await shot('proof');

    mark('Vision — contact sheets of the take');
    await scrollTo(page, sleep, '#vision');
    await sleep(1200);
    await shot('vision');

    mark('Features — the cards warm as the pointer crosses them');
    await scrollTo(page, sleep, '#features');
    for (const index of [0, 1, 4]) {
      await hover(page, moveTo, sleep, page.locator('[data-feature]').nth(index), 800);
    }
    await shot('features');

    mark('Install — one panel per agent');
    await scrollTo(page, sleep, '#install');
    await click(page.locator('#install-tab-codex'), { pause: 'observe' });
    await shot('install-codex');
    await click(page.locator('#install-tab-gemini-cli'), { pause: 'observe' });
    await copyAndCheck(
      page,
      click,
      sleep,
      page.locator('[data-install-panel]:not(.is-inactive) [data-copy-button]').first(),
    );
    await shot('install-copied');

    mark('Back to top — the firefly flies the reader up');
    await click(page.locator('[data-scroll-top]'), { pause: 2600 });
    await shot('back-to-top');

    mark('Language menu — Tiếng Việt, 日本語, 简体中文 and back to English');
    await click(page.locator('[data-lang-trigger]').first(), { pause: 'quick' });
    await shot('language-menu');
    await click(page.locator('[data-set-lang="vi"]').first(), { pause: 'observe' });
    await sleep(900);
    await shot('vietnamese');
    await chooseLanguage(page, click, sleep, 'ja');
    await shot('japanese');
    await chooseLanguage(page, click, sleep, 'zh');
    await shot('chinese');
    await chooseLanguage(page, click, sleep, 'en');

    mark('Closing on Tiếng Việt');
    await chooseLanguage(page, click, sleep, 'vi');
    await sleep(900);
    await shot('closing-vietnamese');
  },
};
