// The three things a recording of page content can never contain, in one take: the dropdown a
// <select> opens, the dialogs the browser puts up, and DevTools.
//
// Recorded with the window backend, which is the only one that could contain any of them. What
// this take is for is finding out which of the three actually do — a <select> menu on macOS is
// its own window and may reach past the browser's, and DevTools takes its room out of the page.
module.exports = {
  name: 'e2e-native-ui',
  start: '/',
  fullPageShot: false,

  async run({ page, mark, click, select, shot, dialog, sleep, baseUrl }) {
    // Where the field is, for the check that follows. A native menu opens directly below it,
    // and it is a small part of the frame — measuring the whole page for a change washes it
    // out. Written from here because this is the only place that can measure the live page.
    const field = await page.locator('#q_status_eq').boundingBox();
    require('fs').writeFileSync(
      `${process.env.OUT_DIR}/geometry.json`,
      `${JSON.stringify({ statusField: field })}\n`,
    );

    mark('Open the status dropdown and choose from it');
    // select() drives the value with arrow keys because the menu cannot be recorded. Whether the
    // menu opens at all under a synthetic click is exactly what this take is measuring, so the
    // click comes first and is held long enough to see one either way.
    await click(page.locator('#q_status_eq'), { pause: 'observe' });
    await shot('dropdown-open');
    await sleep(1200);
    await select(page.locator('#q_status_eq'), 'Suspended');
    await shot('dropdown-chosen');

    mark('Answer a confirm the browser puts up');
    await dialog(async () => {
      await click(page.getByRole('button', { name: 'Delete selected' }), { pause: 'quick' });
    }, { accept: true });
    await shot('confirm-accepted');

    mark('Dismiss a second one instead of accepting it');
    await dialog(async () => {
      await click(page.getByRole('button', { name: 'Delete selected' }), { pause: 'quick' });
    }, { accept: false });
    await shot('confirm-dismissed');

    mark('Acknowledge an alert');
    await dialog(async () => {
      await click(page.getByRole('button', { name: 'Send notice' }), { pause: 'quick' });
    });
    await shot('alert-acknowledged');

    mark('Hold on a page in another language, where Chrome would offer to translate');
    await page.goto(`${baseUrl}/vi`, { waitUntil: 'load' });
    await sleep(2000);
    await shot('another-language');
  },
};
