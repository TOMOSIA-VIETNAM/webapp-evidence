// The step script the end-to-end check records. It exercises every helper that touches the page, so
// a break in any of them shows up as a failed assertion rather than as a video nobody watches:
// typing, a <select> the recording cannot show, a file picker it cannot show either, a keyboard
// shortcut that leaves no trace on screen, a caption, a modal, and screenshots along the way.
//
// The last part is the one the browser cannot prove by itself: a button whose work happens on the
// server, checked by reading the log in the terminal panel.
const path = require('path');

module.exports = {
  name: 'e2e-user-search',
  start: '/',

  async run({ page, mark, click, type, select, upload, hotkey, note, shot, sleep, term }) {
    if (!process.env.DEMO_LOG) throw new Error('DEMO_LOG must point at the demo app\'s log file');

    mark('Open the search screen');
    await sleep(600);
    await shot('start');

    mark('Fill in the search conditions');
    await type(page.locator('#q_name_cont'), 'abc');
    await select(page.locator('#q_status_eq'), 'Active');
    await upload(page.locator('#import_file'), path.join(__dirname, 'fixtures', 'sample.csv'));
    await shot('conditions');

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
    await term.close();
  },
};
