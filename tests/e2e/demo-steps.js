// A short take over the demo app, for watching rather than asserting on. Tighter than the
// end-to-end script beside it: it exists so that a change to how a recording looks can be judged
// by looking at one — the cursor travelling, the ripple on each click, a caption standing in for
// the <select> the frame cannot hold, a modal held long enough to read.
//
// The two commands at the end are there for the panel rather than for the demo app: one that
// prints far more than fits and one that prints a line, so a single take shows the panel opening
// small, growing, revealing a long output a window at a time, and settling back.
//
// Record it against the demo server the way tests/e2e/run.sh starts one:
//
//   node tests/e2e/serve.js                       # prints the URL it is serving on
//   BASE_URL=<that url> OUT_DIR=/tmp/take \
//     node src/skills/recording/scripts/record.js tests/e2e/demo-steps.js
module.exports = {
  name: 'demo',
  start: '/',

  async run({ page, mark, click, type, select, shot, sleep, term, baseUrl }) {
    mark('Open the search screen');
    await sleep(500);

    mark('Fill in the search conditions');
    await type(page.locator('#q_name_cont'), 'abc');
    await select(page.locator('#q_status_eq'), 'Active');

    mark('Run the search');
    await click(page.getByRole('button', { name: 'Search' }), { pause: 'observe' });
    await shot('results');

    mark('Open a row');
    await click(page.getByRole('button', { name: 'Detail' }).first(), { pause: 2400 });
    await click(page.getByRole('button', { name: 'Close' }), { pause: 900 });

    mark('Check the export behind the page');
    await term.open();
    // Printed whole rather than piped through anything, which is the point: this is what a
    // response longer than the panel looks like when it is revealed instead of clipped.
    await term.run(`curl -s ${baseUrl}/report`);
    await shot('export-report');
    // And the same response counted rather than read, so the panel has a reason to settle back.
    await term.run(`curl -s ${baseUrl}/report | wc -l`, { pause: 'quick' });
    await term.close();
  },
};
