// The recording shown in the README. Shorter and tighter than the end-to-end script: it exists to
// show a stranger, in about fifteen seconds, what a take looks like — the cursor travelling, the
// ripple on each click, a caption standing in for the <select> the frame cannot hold, and a modal
// held long enough to read.
//
// Re-record it with docs/demo/record.sh, which turns the mp4 into the gif the README embeds.
module.exports = {
  name: 'demo',
  start: '/',

  async run({ page, mark, click, type, select, shot, sleep }) {
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
  },
};
