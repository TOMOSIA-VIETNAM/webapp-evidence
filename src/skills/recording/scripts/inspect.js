#!/usr/bin/env node
// Probe the interactive elements on a screen so the recording step script can be written with real selectors,
// instead of guessing and going through several run-fail-fix rounds.
// Usage: node inspect.js <path> [--app <app>] [--shot <file.png>] [--limit <n>]
const path = require('path');
const { loadProjectConfig, openSession, closeSession, openPage, HELP_ENV } = require('./session');

function parseArgs(argv) {
  const args = { limit: 40 };
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--app') args.app = argv[++i];
    else if (a === '--shot') args.shot = argv[++i];
    else if (a === '--limit') args.limit = Number(argv[++i]);
    else if (a === '--all') args.all = true;
    else if (a === '--help' || a === '-h') args.help = true;
    else rest.push(a);
  }
  args.target = rest[0];
  return args;
}

function help() {
  console.log(`Probe the interactive elements of a screen (use this before writing the recording step script).

  node inspect.js <path> [options]

    <path>            Path inside the app, for example /users or /users/new
    --app <app>       App declared in evidence.config.js (default: defaultApp)
    --shot <file>     Also capture a full-page screenshot into this file
    --limit <n>       Max number of elements printed per group (default 40)
    --all             Also print elements of the shared navigation chrome (skipped by default to keep it short)

${HELP_ENV}

The output is printed in groups: buttons, inputs, selects (with their options), links.
Each line is a selector you can use directly in the step script.`);
}

// Prefer stable selectors: id > role with label > name > shortened css
const COLLECT = (limit, all) => `(() => {
  const out = { buttons: [], inputs: [], selects: [], links: [] };
  const tidy = (value) => String(value || '').trim().replace(/\\s+/g, ' ').slice(0, 60);
  // The text an accessible name is built from: every text node under the element, minus the
  // branches that are not announced. \`textContent\` alone would include them — a button reading
  // "Save" in markup carrying a hidden "draft" beside it comes out as "Save draft", a name that
  // matches nothing.
  const domText = (el) => {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const parts = [];
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      let announced = true;
      for (let up = node.parentElement; up && up !== el.parentElement; up = up.parentElement) {
        const style = getComputedStyle(up);
        if (style.display === 'none' || style.visibility === 'hidden' || up.getAttribute('aria-hidden') === 'true') {
          announced = false;
          break;
        }
      }
      if (announced) parts.push(node.nodeValue);
    }
    return parts.join('');
  };
  // Two readings of the same element, and the difference between them is what makes a printed
  // selector work or silently never match. Playwright matches a role's name against the text in the
  // DOM, where \`text-transform\` does not reach: a name taken off the screen ("SIGN IN") never
  // resolves against markup that says "Sign in", and passing it as a regex is worse, because regex
  // name matching is case sensitive and matches nothing without saying so.
  const text = (el) => tidy(domText(el) || el.value || el.getAttribute('aria-label') || el.getAttribute('title'));
  const shown = (el) => tidy(el.innerText || el.value || el.getAttribute('aria-label') || el.getAttribute('title'));
  // The shared navigation chrome repeats on every screen, so it is only noise when writing a step script
  const skipChrome = ${all ? 'false' : 'true'};
  const chrome = (el) => skipChrome && !!el.closest('nav, aside, .navbar, .sidebar, header');
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden';
  };
  const selectorFor = (el, role) => {
    if (el.id) return '#' + CSS.escape(el.id);
    const label = text(el);
    // The name goes through JSON.stringify: a label holding an apostrophe — "Don't save", "User's
    // report" — would otherwise close the quote and print a line that is not JavaScript.
    if (label && role) return \`getByRole('\${role}', { name: \${JSON.stringify(label)} })\`;
    if (el.name) return \`[name="\${el.name}"]\`;
    return el.tagName.toLowerCase() + (el.className && typeof el.className === 'string'
      ? '.' + el.className.trim().split(/\\s+/).slice(0, 2).join('.')
      : '');
  };

  document.querySelectorAll('button, input[type=submit], input[type=button], a.btn, [role=button]').forEach((el) => {
    if (visible(el) && !chrome(el) && out.buttons.length < ${limit}) {
      const name = text(el);
      const onScreen = shown(el);
      out.buttons.push({
        label: name, selector: selectorFor(el, 'button'), disabled: !!el.disabled,
        shown: onScreen === name ? null : onScreen,
      });
    }
  });

  document.querySelectorAll('input:not([type=submit]):not([type=button]):not([type=hidden]), textarea').forEach((el) => {
    if (visible(el) && !chrome(el) && out.inputs.length < ${limit}) {
      out.inputs.push({
        label: (el.labels && el.labels[0] ? el.labels[0].innerText.trim() : '') || el.placeholder || el.name || '',
        type: el.type || 'textarea',
        selector: selectorFor(el),
      });
    }
  });

  document.querySelectorAll('select').forEach((el) => {
    if (visible(el) && !chrome(el) && out.selects.length < ${limit}) {
      out.selects.push({
        label: (el.labels && el.labels[0] ? el.labels[0].innerText.trim() : '') || el.name || '',
        selector: selectorFor(el),
        options: Array.from(el.options).map((o) => o.text.trim()).filter(Boolean).slice(0, 15),
      });
    }
  });

  document.querySelectorAll('a[href]:not(.btn)').forEach((el) => {
    if (visible(el) && !chrome(el) && text(el) && out.links.length < ${limit}) {
      const name = text(el);
      const onScreen = shown(el);
      out.links.push({ label: name, href: el.getAttribute('href'), shown: onScreen === name ? null : onScreen });
    }
  });

  return out;
})()`;

function print(group, rows, render) {
  console.log(`\n## ${group} (${rows.length})`);
  if (!rows.length) {
    console.log('  (none)');
    return;
  }
  rows.forEach((r) => console.log(`  ${render(r)}`));
}

(async () => {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.target) {
    help();
    process.exit(args.help ? 0 : 1);
  }

  const { config } = loadProjectConfig(process.cwd());
  const app = args.app || config.defaultApp;
  const session = await openSession({ config, app });
  const { page, baseUrl } = session;

  const url = args.target.startsWith('http') ? args.target : `${baseUrl}${args.target}`;
  await openPage(page, url);

  const found = await page.evaluate(COLLECT(args.limit, args.all));

  console.log(`# ${url}`);
  console.log(`title: ${await page.title()}`);
  // The selector matches on the text in the DOM; what is on screen is printed after it when CSS
  // renders the two differently, so the line can still be found by eye on the page.
  const asShown = (r) => (r.shown ? `  (on screen: ${r.shown})` : '');
  print('Buttons', found.buttons, (r) => `${r.selector}${r.disabled ? '  [disabled]' : ''}  — ${r.label}${asShown(r)}`);
  print('Inputs', found.inputs, (r) => `${r.selector}  (${r.type})  — ${r.label}`);
  print('Selects', found.selects, (r) => `${r.selector}  — ${r.label}\n      options: ${r.options.join(' / ')}`);
  print('Links', found.links, (r) => `${r.href}  — ${r.label}${asShown(r)}`);

  if (session.problems.length) {
    console.log(`\n## Page errors while opening (${session.problems.length})`);
    session.problems.slice(0, 10).forEach((p) => console.log(`  ${p}`));
  }

  if (args.shot) {
    const file = path.resolve(args.shot);
    await page.screenshot({ path: file, fullPage: true });
    console.log(`\nScreenshot: ${file}`);
  }

  await closeSession(session);
})().catch((e) => {
  console.error(String((e && e.message) || e));
  process.exit(1);
});
