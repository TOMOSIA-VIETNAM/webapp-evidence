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

const { scrollTo, hover, chooseLanguage, copyAndCheck } = require('./tour-helpers');

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
