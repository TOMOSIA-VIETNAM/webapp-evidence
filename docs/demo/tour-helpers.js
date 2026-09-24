// Moves a tour of a landing page makes the way a reader would: wheel scrolling that comes to rest
// with a section framed, a hover held long enough for the page to answer, the language menu, and a
// copy button read back for its "Copied" state. Shared by the README demo (docs/demo/) and the tour
// the site records of itself (webapp/demo/).
//
// Written for pages built like these two: smooth scrolling through Lenis, a fixed header whose
// height is the CSS variable --nav-height, the language menu's data-lang-trigger / data-set-lang,
// and copy buttons carrying data-copy-label and data-label-copied.

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

module.exports = { scrollTo, hover, chooseLanguage, copyAndCheck };
