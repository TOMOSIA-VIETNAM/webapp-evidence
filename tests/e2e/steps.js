// The step script the end-to-end check records. It exercises every helper that touches the page, so
// a break in any of them shows up as a failed assertion rather than as a video nobody watches:
// typing, a <select> the recording cannot show, a file picker it cannot show either, a keyboard
// shortcut that leaves no trace on screen, a caption, a modal, and screenshots along the way.
//
// The last part is the one the browser cannot prove by itself: a button whose work happens on the
// server, checked by reading the log in the terminal panel, and an endpoint called in that same
// panel with the session the browser is holding.
const path = require('path');

module.exports = {
  name: 'e2e-user-search',
  start: '/',

  async run({ page, mark, click, type, select, upload, hotkey, note, shot, scrollTo, drag, sleep, term, redact, api }) {
    if (!process.env.DEMO_LOG) throw new Error('DEMO_LOG must point at the demo app\'s log file');

    mark('Open the search screen');
    await sleep(600);
    await shot('start');

    mark('Fill in the search conditions');
    await type(page.locator('#q_name_cont'), 'abc');
    await select(page.locator('#q_status_eq'), 'Active');
    await upload(page.locator('#import_file'), path.join(__dirname, 'fixtures', 'sample.csv'));
    await shot('conditions');

    mark('Drag the slider that says how many rows to show');
    // A handle is what no other helper reaches: click() has nothing to click, and setting the value
    // through the DOM changes the number on screen with nobody touching it.
    const before = Number(await page.locator('#rows_shown').inputValue());
    await drag(page.locator('#rows_shown'), { dx: 90 }, { pause: 'quick' });
    const after = Number(await page.locator('#rows_shown').inputValue());
    if (!(after > before)) {
      throw new Error(`The slider still reads ${after}, so the drag never reached it`);
    }

    mark('Run the search');
    await click(page.getByRole('button', { name: 'Search' }), { pause: 'observe' });
    await shot('results');

    mark('Copy the name field, to show a shortcut on screen');
    await hotkey('ControlOrMeta+A', { label: 'Select all', target: page.locator('#q_name_cont') });
    await hotkey('ControlOrMeta+C', { label: 'Copy' });

    mark('Open a row, then close it');
    await note('This list comes from the demo fixture, not from data created by these steps.');
    await click(page.getByRole('button', { name: 'Detail' }).first(), { pause: 2600 });
    await shot('detail');
    await click(page.getByRole('button', { name: 'Close' }), { pause: 1200 });

    // Chrome raises its offer to translate over the page, and no launch switch stops it. The
    // page says it itself, and this is where that can be checked without a screen — the
    // headless take carries the same init script as a window one.
    const noTranslate = await page.evaluate(() => ({
      meta: Boolean(document.querySelector('meta[name="google"][content~="notranslate"]')),
      attribute: document.documentElement.getAttribute('translate'),
    }));
    if (!noTranslate.meta || noTranslate.attribute !== 'no') {
      throw new Error(`The page was not marked notranslate: ${JSON.stringify(noTranslate)}`);
    }

    mark('Reach the audit trail below the fold');
    // The button is off screen, so this click can only happen by scrolling — and the check is on
    // how the page got there. Jumping to it lands in the video as a cut, with the cursor sliding
    // towards something that was not on screen a frame earlier; the step count below is what
    // tells one from the other without watching anything.
    await click(page.getByRole('button', { name: 'Archive the trail' }), { pause: 'observe' });
    const scrolled = await page.evaluate(() => window.__scrollSteps);
    if (scrolled.length < 5) {
      throw new Error(`The page reached the button in ${scrolled.length} scroll steps; a viewer cannot follow that`);
    }
    const longest = Math.max(...scrolled);
    if (longest > 260) {
      throw new Error(`One scroll step covered ${longest}px, which reads as a jump rather than a scroll`);
    }
    // A button inside an <iframe>: its position is measured in that frame's coordinates and the
    // mouse is driven in the page's, so a click that misses lands on nothing and changes nothing.
    // The button's own label is what says the two were reconciled.
    const embedded = page.frameLocator('#embedded').locator('#confirm');
    await click(embedded, { pause: 'quick' });
    const confirmed = await embedded.innerText();
    if (confirmed === 'Confirm the report') {
      throw new Error('The click inside the frame did not reach the button');
    }
    await shot('audit-trail');

    mark('Travel to a section that holds nothing to click');
    // Nothing in this section can be clicked, so it can only be reached by scrolling to it — and
    // where the scroll comes to rest is the whole point. A section that fits the frame has to end
    // up whole inside it, clear of the header the page keeps pinned over the top: resting with the
    // section split across the fold reads as a scroll that stopped halfway rather than arrived.
    await scrollTo(page.locator('#summary'));
    const rested = await page.evaluate(() => {
      const box = document.getElementById('summary').getBoundingClientRect();
      return {
        top: box.top,
        bottom: box.bottom,
        header: document.querySelector('header').getBoundingClientRect().bottom,
        frame: window.innerHeight,
      };
    });
    if (rested.top < rested.header) {
      throw new Error(`The section came to rest at ${rested.top}, behind a header ${rested.header}px deep`);
    }
    if (rested.bottom > rested.frame) {
      throw new Error(`The section came to rest with ${Math.round(rested.bottom - rested.frame)}px of it below the frame`);
    }
    await shot('summary');

    mark('Reveal a value that must not survive into the evidence');
    // The element does not exist on screen until the button is pressed, so the rectangle can only
    // be measured on the way out — which is the case worth exercising here.
    await redact(page.locator('#api_key'), async () => {
      await click(page.getByRole('button', { name: 'Reveal API key' }), { pause: 'observe' });
      await shot('key-masked');
    }, { mode: 'box' });

    mark('Trigger the sync, whose work happens on the server');
    await click(page.getByRole('button', { name: 'Run sync' }), { pause: 'observe' });

    mark('Read the worker log to prove the job ran');
    await term.open();
    // The shell inherits the runner's environment, so the log can be named the same way the
    // check names it, instead of a screen's worth of absolute path being typed into the video.
    await term.start('tail -f "$DEMO_LOG"');
    await term.waitFor(/SyncJob \d+ finished/, { timeout: 20000 });
    await shot('worker-finished');
    await term.interrupt();
    await term.run('wc -l < "$DEMO_LOG"');

    mark('Call the export endpoint with the session the browser is holding');
    // The request is made from the same session as the page, and the cookie carrying it reaches
    // curl as a file: the check afterwards greps the runbook for that value and fails if it is
    // anywhere in the evidence.
    const req = await api.from(page);
    await req.curl('GET', '/report', { expect: 200, jq: '.records[0]' });
    await shot('api-response');
    await term.close();
  },
};
