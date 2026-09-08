// The recording shown in the README: the Swag Labs (saucedemo.com) checkout flow — sign in, sort by
// price, add a product to the cart, complete the order.
//
// saucedemo.com exists to be automated, so recording it breaks nobody's terms, and the account below
// is the public demo one printed on its own sign-in page. Selectors were probed on the running page
// with inspect.js rather than guessed.
//
// Re-record with docs/demo/record.sh.

module.exports = {
  name: 'saucedemo-checkout',
  start: '/',

  async run({ page, mark, click, type, select, note, shot, sleep }) {
    mark('Open the sign-in screen');
    await sleep(1200);
    await shot('login');

    mark('Sign in as standard_user');
    // Credentials are the public demo account printed on the sign-in page itself.
    await type(page.locator('#user-name'), 'standard_user');
    await type(page.locator('#password'), 'secret_sauce');
    await click(page.locator('#login-button'), { pause: 'observe' });
    await shot('product-list');

    mark('Sort the product list by Price (low to high)');
    // A plain <select> dropdown is drawn by the operating system and never enters the video,
    // so the screenshot after choosing is what proves the sort was applied.
    await select(page.locator('[data-test="product-sort-container"]'), 'Price (low to high)');
    await sleep(800);
    await shot('sorted-price-low-to-high');

    mark('Add Sauce Labs Backpack to the cart');
    await click(page.locator('#add-to-cart-sauce-labs-backpack'), { pause: 'observe' });
    await shot('backpack-added');

    mark('Open the shopping cart');
    await click(page.locator('[data-test="shopping-cart-link"]'), { pause: 'observe' });
    await shot('cart');

    mark('Enter the customer information');
    await click(page.locator('#checkout'), { pause: 'quick' });
    await type(page.locator('#first-name'), 'Minh');
    await type(page.locator('#last-name'), 'Tang');
    await type(page.locator('#postal-code'), '700000');
    await shot('checkout-information-filled');

    mark('Review the order summary');
    await click(page.locator('#continue'), { pause: 'observe' });
    await shot('order-summary');

    mark('Finish the order');
    await click(page.locator('#finish'), { pause: 'observe' });
    await note('The order is placed on the public saucedemo.com demo site, so no real data is created.');
    await sleep(1200);
    await shot('order-complete');
  },
};
