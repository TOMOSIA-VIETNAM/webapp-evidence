// The step script for the window-capture check. Short on purpose: what is being proved is that
// the frame is the browser window rather than the page, not that the helpers work — the main
// end-to-end take already covers those, headless.
module.exports = {
  name: 'e2e-window-capture',
  start: '/',
  // Taken outside the recording context, so it would be a page screenshot whatever the backend is
  fullPageShot: false,

  async run({ page, mark, click, type, shot, sleep, baseUrl }) {
    mark('Search on the demo screen');
    await type(page.locator('#q_name_cont'), 'abc');
    await click(page.getByRole('button', { name: 'Search' }), { pause: 'observe' });
    await shot('results');

    // One flat colour fills the content area, so the check can say where the browser window is
    // in the frame without comparing images.
    mark('Hold on a page of one colour, so the frame can be measured');
    await page.goto(`${baseUrl}/solid`, { waitUntil: 'load' });
    await sleep(2500);
  },
};
