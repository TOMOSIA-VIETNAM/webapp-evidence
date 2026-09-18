// A take that fails on purpose, which is the one thing the passing take cannot cover: what the
// runner does when a step script throws. The recorder has to stop there and then — with the screen
// as its source it would otherwise go on writing whatever else is on the operator's display until
// its own time limit — the raw capture must not be left behind unexplained, and the error has to
// say which step the run died in.
module.exports = {
  name: 'e2e-failed-take',
  start: '/',

  async run({ page, mark, click }) {
    mark('Search, and then stop on purpose');
    await click(page.getByRole('button', { name: 'Search' }), { pause: 'quick' });
    throw new Error('the step script stopped here on purpose');
  },
};
