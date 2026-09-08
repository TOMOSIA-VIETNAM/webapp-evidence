// The step script the end-to-end check records. It exercises every helper that touches the page, so
// a break in any of them shows up as a failed assertion rather than as a video nobody watches:
// typing, a <select> the recording cannot show, a file picker it cannot show either, a keyboard
// shortcut that leaves no trace on screen, a caption, a modal, and screenshots along the way.
const path = require('path');

module.exports = {
  name: 'e2e-user-search',
  start: '/',

  async run({ page, mark, click, type, select, upload, hotkey, note, shot, sleep }) {
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
    await note('This list comes from the demo fixture, not from data created by these steps.', {
      target: page.locator('#row_1001'),
    });
    await click(page.getByRole('button', { name: 'Detail' }).first(), { pause: 2600 });
    await shot('detail');
    await click(page.getByRole('button', { name: 'Close' }), { pause: 1200 });
  },
};
