// The recording this site shows of itself: the page recorded by the tool it advertises. It walks
// the languages, then down the page using what each section does — the firefly under the pointer,
// the copy button, the UAT report picked criterion by criterion, the proof layers, the feature
// cards, the install tabs — flies back to the top, and reads the SEO meta the page serves in the
// terminal panel.
//
// The `mark()` labels are load-bearing: the UAT report on the page finds its proof in the runbook
// by these labels (src/components/sections/Uat.astro), and demo/record.sh cuts the web copy between
// two of them. Rename one and follow it there.
//
// Selectors are the page's own data attributes. Re-record with demo/record.sh.

const { scrollTo, hover, chooseLanguage, copyAndCheck } = require('../../docs/demo/tour-helpers');

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

    mark('Hero — the firefly answers the pointer');
    await hover(page, moveTo, sleep, page.locator('[data-hero-mascot]'), 1500);
    await shot('hero-firefly');

    mark('Hero — copy the command that starts a recording');
    await copyAndCheck(page, click, sleep, page.locator('[data-copy-button]').first());
    await note('The button was read back for its "Copied" state: a blocked clipboard leaves a click that proves nothing.');
    await shot('hero-copied');

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

    mark('SEO meta — the title, description and social card the page serves');
    await term.open();
    await term.run(seoCommand, { pause: 'observe' });
    await shot('seo-meta');
    await term.close();

    mark('Closing on Tiếng Việt');
    await chooseLanguage(page, click, sleep, 'vi');
    await sleep(900);
    await shot('closing-vietnamese');
  },
};
