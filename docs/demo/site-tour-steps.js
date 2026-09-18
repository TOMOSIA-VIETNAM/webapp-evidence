// The recording shown in the README: a tour of the open-pr landing page in production — every
// language the menu offers, then down the page section by section using whatever each section
// actually does (the moth under the pointer, the copy buttons, the round walkthrough, the feature
// cards, the install tabs), the floating return to the top, the SEO meta the page really serves,
// and Japanese as the closing state.
//
// It is a public marketing page with no account and no data behind it, so recording it creates
// nothing and breaks nobody's terms. Selectors are the page's own data attributes, probed on the
// running page with inspect.js rather than guessed.
//
// Re-record with docs/demo/record.sh.

// Cut to one screen wide so every line stays readable inside the terminal panel.
const SEO_COMMAND =
  "curl -s https://open-pr.vercel.app/ | " +
  "grep -oE '<title>[^<]*</title>|<meta[^>]*(name=\"description\"|property=\"og:(title|url|image|locale)\")[^>]*>' | " +
  "cut -c1-100";

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
  name: 'site-tour',
  start: '/',

  async run({ page, mark, click, note, shot, sleep, moveTo, term }) {
    // Chrome refuses navigator.clipboard.writeText without this, and the copy buttons hang on it.
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write'], {
      origin: 'https://open-pr.vercel.app',
    });

    mark('Hero — the page as it opens');
    await sleep(1800);
    await shot('hero');

    mark('Language menu — every language the site ships');
    await click(page.locator('[data-lang-trigger]').first(), { pause: 'quick' });
    await shot('language-menu');
    await click(page.locator('[data-set-lang="vi"]').first(), { pause: 'observe' });
    await sleep(900);
    await shot('vietnamese');
    await chooseLanguage(page, click, sleep, 'ja');
    await shot('japanese');
    await chooseLanguage(page, click, sleep, 'zh');
    await shot('chinese');

    mark('Back to English — the language the rest of the tour runs in');
    await chooseLanguage(page, click, sleep, 'en');
    await shot('english');

    mark('Hero — the moth answers the pointer');
    await hover(page, moveTo, sleep, page.locator('[data-hero-mascot]'), 1500);
    await shot('hero-logo-hover');

    mark('Hero — copy the one-line install command');
    await copyAndCheck(page, click, sleep, page.locator('[data-copy-button]').first());
    await note('The command is on the clipboard. The button was read back for its "Copied" state, because a blocked clipboard leaves a click that proves nothing.');
    await shot('hero-copied');

    mark('How it works — the three steps light up under the pointer');
    await scrollTo(page, sleep, '#how-it-works');
    for (const index of [0, 1, 2]) {
      await hover(page, moveTo, sleep, page.locator('[data-how-step]').nth(index), 900);
    }
    await shot('how-it-works');

    mark('Review rounds — the walkthrough plays itself');
    await scrollTo(page, sleep, '#review-rounds');
    await sleep(3000);
    await shot('rounds-playing');

    // Every step in turn: each one marks the lines of its own round and dims the rest, and the
    // last one puts the whole thread back to full strength.
    mark('Review rounds — every step of the loop, picked by hand');
    for (const round of [1, 2, 3, 4, 5]) {
      await click(page.locator(`[data-round-step="${round}"]`), { pause: 'observe' });
      await shot(`rounds-step-${round}`);
    }

    mark('Features — the cards warm as the pointer crosses them');
    await scrollTo(page, sleep, '#features');
    for (const index of [0, 1, 4]) {
      await hover(page, moveTo, sleep, page.locator('[data-feature]').nth(index), 900);
    }
    await shot('features');

    mark('Token cost — the chart the plugin publishes');
    await scrollTo(page, sleep, '#token-cost');
    await sleep(900);
    await shot('token-cost');

    mark('Install — one panel per agent');
    await scrollTo(page, sleep, '#install');
    await click(page.locator('#install-tab-codex'), { pause: 'observe' });
    await shot('install-codex');
    await click(page.locator('#install-tab-cursor'), { pause: 'observe' });
    await shot('install-cursor');

    // The panels that are not showing are switched off with a class, not the hidden attribute.
    mark('Install — copy the command of the open panel');
    await copyAndCheck(
      page,
      click,
      sleep,
      page.locator('[data-install-panel]:not(.is-inactive) [data-copy-button]').first(),
    );
    await shot('install-copied');

    mark('Footer — the links at the end of the page');
    await scrollTo(page, sleep, 'footer');
    await hover(page, moveTo, sleep, page.getByRole('contentinfo').getByRole('link', { name: 'Releases' }), 800);
    await hover(page, moveTo, sleep, page.getByRole('contentinfo').getByRole('link', { name: 'Issues' }), 800);
    await shot('footer');

    mark('The floating button flies the reader back to the top');
    await click(page.locator('[data-scroll-top]'), { pause: 2600 });
    await shot('back-to-top');

    mark('The SEO meta the page serves, read straight off the URL');
    await term.open();
    await note('The terminal panel runs against the live URL, so these tags come from what the site is serving right now.');
    await term.run(SEO_COMMAND, { pause: 'observe' });
    await shot('seo-meta');
    await term.close();

    mark('Closing on 日本語');
    await chooseLanguage(page, click, sleep, 'ja');
    await sleep(900);
    await shot('closing-japanese');
  },
};
