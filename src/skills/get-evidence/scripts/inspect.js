#!/usr/bin/env node
// Probe the interactive elements on a screen so the recording step script can be written with real selectors,
// instead of guessing and going through several run-fail-fix rounds.
// Usage: node inspect.js <path> [--app <app>] [--shot <file.png>] [--limit <n>]
const path = require('path');
const { loadProjectConfig, openSession, closeSession, HELP_ENV } = require('./session');

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
  const text = (el) => (el.innerText || el.value || el.getAttribute('aria-label') || el.getAttribute('title') || '')
    .trim().replace(/\\s+/g, ' ').slice(0, 60);
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
    if (label && role) return \`getByRole('\${role}', { name: '\${label}' })\`;
    if (el.name) return \`[name="\${el.name}"]\`;
    return el.tagName.toLowerCase() + (el.className && typeof el.className === 'string'
      ? '.' + el.className.trim().split(/\\s+/).slice(0, 2).join('.')
      : '');
  };

  document.querySelectorAll('button, input[type=submit], input[type=button], a.btn, [role=button]').forEach((el) => {
    if (visible(el) && !chrome(el) && out.buttons.length < ${limit}) {
      out.buttons.push({ label: text(el), selector: selectorFor(el, 'button'), disabled: !!el.disabled });
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
      out.links.push({ label: text(el), href: el.getAttribute('href') });
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
  await page.goto(url, { waitUntil: 'networkidle' });

  const found = await page.evaluate(COLLECT(args.limit, args.all));

  console.log(`# ${url}`);
  console.log(`title: ${await page.title()}`);
  print('Buttons', found.buttons, (r) => `${r.selector}${r.disabled ? '  [disabled]' : ''}  — ${r.label}`);
  print('Inputs', found.inputs, (r) => `${r.selector}  (${r.type})  — ${r.label}`);
  print('Selects', found.selects, (r) => `${r.selector}  — ${r.label}\n      options: ${r.options.join(' / ')}`);
  print('Links', found.links, (r) => `${r.href}  — ${r.label}`);

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
