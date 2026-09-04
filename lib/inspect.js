#!/usr/bin/env node
// Dò các phần tử tương tác trên một màn hình để viết kịch bản quay bằng selector có thật,
// thay vì đoán rồi chạy-lỗi-sửa nhiều vòng.
// Cách dùng: node inspect.js <path> [--app <app>] [--shot <file.png>] [--limit <n>]
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
  console.log(`Dò phần tử tương tác của một màn hình (dùng trước khi viết kịch bản quay).

  node inspect.js <path> [tuỳ chọn]

    <path>            Đường dẫn trong app, ví dụ /users hoặc /users/new
    --app <app>       App khai báo trong evidence.config.js (mặc định: defaultApp)
    --shot <file>     Chụp thêm ảnh toàn trang ra file này
    --limit <n>       Số phần tử tối đa in ra mỗi nhóm (mặc định 40)
    --all             In cả phần tử của menu/điều hướng chung (mặc định bỏ qua cho gọn)

${HELP_ENV}

Kết quả in ra theo nhóm: nút, ô nhập, select (kèm danh sách lựa chọn), liên kết.
Mỗi dòng là một selector dùng được ngay trong kịch bản.`);
}

// Ưu tiên selector bền: id > role kèm nhãn > name > css rút gọn
const COLLECT = (limit, all) => `(() => {
  const out = { buttons: [], inputs: [], selects: [], links: [] };
  const text = (el) => (el.innerText || el.value || el.getAttribute('aria-label') || el.getAttribute('title') || '')
    .trim().replace(/\\s+/g, ' ').slice(0, 60);
  // Menu/điều hướng chung lặp lại ở mọi màn nên chỉ gây nhiễu khi viết kịch bản
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
    console.log('  (không có)');
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
  print('Nút', found.buttons, (r) => `${r.selector}${r.disabled ? '  [disabled]' : ''}  — ${r.label}`);
  print('Ô nhập', found.inputs, (r) => `${r.selector}  (${r.type})  — ${r.label}`);
  print('Select', found.selects, (r) => `${r.selector}  — ${r.label}\n      lựa chọn: ${r.options.join(' / ')}`);
  print('Liên kết', found.links, (r) => `${r.href}  — ${r.label}`);

  if (session.problems.length) {
    console.log(`\n## Lỗi trang khi mở (${session.problems.length})`);
    session.problems.slice(0, 10).forEach((p) => console.log(`  ${p}`));
  }

  if (args.shot) {
    const file = path.resolve(args.shot);
    await page.screenshot({ path: file, fullPage: true });
    console.log(`\nẢnh: ${file}`);
  }

  await closeSession(session);
})().catch((e) => {
  console.error(String((e && e.message) || e));
  process.exit(1);
});
