// The project's evidence configuration. The runner (the get-evidence skill) knows nothing about any
// particular app — everything specific to the project lives here.
//
// Where to put it:
//   - Shared configuration: <the project's evidence dir>/evidence.config.js
//   - Configuration for a single issue: put it next to the step script, require the shared
//     configuration and override only the part that has to change.
//     An override has to sit at the level it belongs to, because a shallow spread carries the
//     nested objects of the shared configuration over as they are:
//     const base = require('../../evidence/evidence.config.js');
//     module.exports = { ...base, recording: { ...base.recording, speed: 'slow' } };
const { execFileSync } = require('child_process');

module.exports = {
  // App used when the step script does not declare `app`
  defaultApp: 'admin',

  // Everything that affects the recording.
  recording: {
    locale: 'en-US',

    // How fast the actions run in the video, read it as the playback rate of a video player:
    // a bigger number = faster. Use the named levels for brevity, or a number for your own level.
    //   'slowest' (0.5×) | 'slow' (0.67×) | 'normal' (1×) | 'fast' (1.67×)
    //   or a number within 0.2–5, for example 0.8 to go a little slower than normal
    speed: 'normal',

    // viewport: { width: 1280, height: 800 },
    // browserChannel: 'chrome',
    // headed: false,
    // video: { crf: 26, preset: 'slow' },

    // To tune individual kinds of action (the wait after a click, the typing speed…) declare `pace`.
    // The list of keys and their default values lives in scripts/settings.js. Most of the time the
    // `speed` above is all you need and there is no reason to touch this.
    // pace: { afterClickMs: 1200 },
  },

  output: {
    // false (the default): older recordings are moved aside into evidence/v1, v2… before the new
    // take is recorded, because evidence already sent along with an MR is lost for good once it is
    // overwritten, and with it anything left to compare against.
    // true: delete the old take and record over it.
    overwrite: false,

    // Where the account used for recording is remembered. It must sit inside a gitignored area,
    // because it holds a password.
    accountStore: '.evidence/accounts.json',
  },

  apps: {
    admin: {
      baseUrl: 'http://localhost:3000',

      // Set the environment up before the browser opens. Return an array describing what was fixed,
      // so the runner can print it for the user. Throw if it cannot be fixed here.
      async prepare() {
        const fixed = [];
        // For example: start the server, install a missing dependency, wait for the build to finish…
        return fixed;
      },

      // Log in in a separate context (which is not recorded), then return the storageState for the
      // recorded context. `store` keeps the account between runs; `generatePassword` produces a
      // strong enough password.
      async login({ browser, app, baseUrl, viewport, store, generatePassword }) {
        let account = store.get(app);
        if (!account) {
          // Take an account that already exists in the dev environment and set a password on it for
          // recording, so the user does not have to be asked again next time.
          const password = generatePassword();
          const email = execFileSync('...', ['...']).toString().trim();
          account = store.set(app, { email, password });
        }

        const context = await browser.newContext({ viewport, locale: 'en-US' });
        const page = await context.newPage();
        await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded' });
        await page.locator('#email').fill(account.email);
        await page.locator('#password').fill(account.password);
        await Promise.all([
          page.waitForURL((u) => !u.pathname.includes('login'), { timeout: 20000 }),
          page.locator('button[type=submit]').click(),
        ]);

        const state = await context.storageState();
        await context.close();
        return state;
      },
    },
  },
};
