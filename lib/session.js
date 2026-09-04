// Phần dùng chung của record.js và inspect.js: đọc cấu hình dự án, nhớ tài khoản,
// dựng môi trường, đăng nhập và mở sẵn một trang đã đăng nhập.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const { chromium } = require('playwright-core');
const { resolveSettings } = require('./settings');

const VIEWPORT = { width: 1280, height: 800 };
const SKILL_DIR = path.resolve(__dirname, '..');
const ROOT = process.env.PROJECT_ROOT || process.cwd();

// Thư mục skill là tài sản dùng chung cho mọi dự án: mọi thứ sinh ra khi quay (cấu hình, tài
// khoản, kịch bản, kết quả, file thử tạm) đều thuộc về dự án, không được nằm ở đây. Chặn sớm
// thay vì để rác tích lại rồi lẫn sang dự án khác.
function assertOutsideSkill(target, what) {
  const resolved = path.resolve(target);
  if (resolved === SKILL_DIR || resolved.startsWith(`${SKILL_DIR}${path.sep}`)) {
    throw new Error(
      `${what} đang trỏ vào trong thư mục skill (${resolved}).\n` +
      'Chạy lại từ thư mục gốc của dự án, hoặc đặt PROJECT_ROOT / OUT_DIR về đường dẫn trong dự án.'
    );
  }
  return resolved;
}

assertOutsideSkill(ROOT, 'Thư mục đang chạy');

const HELP_ENV = `Biến môi trường:
    EVIDENCE_CONFIG   Đường dẫn cấu hình dự án (mặc định: dò từ thư mục kịch bản đi lên)
    BASE_URL          Ghi đè URL gốc của app
    HEADED=1          Hiện cửa sổ trình duyệt (mặc định ẩn, tránh người dùng lỡ thao tác)
    BROWSER_CHANNEL   Kênh trình duyệt của Playwright (mặc định chrome)`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Runner không biết gì về app cụ thể: URL, cách dựng môi trường và cách đăng nhập
// đều do dự án khai báo trong evidence.config.js.
//
// Tìm theo thứ tự từ gần đến xa, để một issue có thể có cấu hình riêng đặt cạnh kịch bản
// mà vẫn dùng chung cấu hình của dự án khi không cần gì đặc biệt:
//   1. EVIDENCE_CONFIG
//   2. <thư mục kịch bản>/evidence.config.js
//   3. leo dần lên: <cấp>/evidence.config.js hoặc <cấp>/evidence/evidence.config.js
//   4. <root>/.claude/evidence.config.js
function configCandidates(startDir) {
  const found = [];
  let dir = startDir ? path.resolve(startDir) : ROOT;
  const stop = path.parse(dir).root;
  while (true) {
    found.push(path.join(dir, 'evidence.config.js'));
    found.push(path.join(dir, 'evidence', 'evidence.config.js'));
    if (dir === ROOT || dir === stop) break;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  found.push(path.join(ROOT, '.claude/evidence.config.js'));
  return found;
}

// Khi chạy từ thư mục gốc (ví dụ lúc dò selector, chưa có kịch bản) thì đường leo lên
// không đi qua nơi đặt cấu hình, nên quét nông thêm vài cấp để khỏi bắt người dùng gõ --config.
function scanForConfig(maxDepth = 3) {
  const skip = new Set(['node_modules', '.git', 'tmp', 'log', 'coverage', 'public', 'vendor']);
  const found = [];
  const walk = (dir, depth) => {
    if (depth > maxDepth || found.length > 5) return;
    let entries = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.isFile() && entry.name === 'evidence.config.js') found.push(path.join(dir, entry.name));
      if (entry.isDirectory() && !entry.name.startsWith('.') && !skip.has(entry.name)) {
        walk(path.join(dir, entry.name), depth + 1);
      }
    }
  };
  walk(ROOT, 0);
  return found;
}

function loadProjectConfig(startDir) {
  if (process.env.EVIDENCE_CONFIG) {
    const file = path.resolve(process.env.EVIDENCE_CONFIG);
    if (!fs.existsSync(file)) throw new Error(`Không tìm thấy cấu hình: ${file}`);
    return { file, config: require(file) };
  }
  for (const file of configCandidates(startDir)) {
    if (fs.existsSync(file)) return { file, config: require(file) };
  }

  const scanned = scanForConfig();
  if (scanned.length === 1) return { file: scanned[0], config: require(scanned[0]) };
  if (scanned.length > 1) {
    throw new Error(
      `Có nhiều evidence.config.js, chỉ rõ bằng EVIDENCE_CONFIG=<đường dẫn>:\n` +
      scanned.map((f) => `  ${f}`).join('\n')
    );
  }

  throw new Error(
    'Không tìm thấy evidence.config.js.\n' +
    `Tạo file này từ ${path.join(__dirname, '../templates/evidence.config.example.js')},\n` +
    'đặt cạnh kịch bản (cấu hình riêng của issue) hoặc ở thư mục evidence chung của dự án.'
  );
}

// Adapter đăng nhập của dự án tự quyết định lấy tài khoản ở đâu; skill chỉ lo phần đọc/ghi
// để lần quay sau không phải hỏi lại người dùng.
// File tài khoản chứa mật khẩu và nằm lại lâu dài, nên yêu cầu ignore ở đây là bắt buộc —
// không có cửa thoát như với thư mục kết quả.
function assertAccountStoreIgnored(file) {
  try {
    execFileSync('git', ['rev-parse', '--show-toplevel'], { stdio: 'ignore' });
  } catch {
    return; // không phải git repo
  }
  try {
    execFileSync('git', ['check-ignore', '-q', file], { stdio: 'ignore' });
  } catch (e) {
    if (e.status !== 1) return;
    throw new Error(
      `File tài khoản sẽ chứa mật khẩu nhưng chỗ lưu chưa được ignore:\n  ${file}\n\n` +
      'Đặt accountStore vào vùng đã ignore của dự án, hoặc nhờ người dùng thêm dòng ignore cho nó.'
    );
  }
}

function makeAccountStore(storePath) {
  const file = path.isAbsolute(storePath) ? storePath : path.join(ROOT, storePath);
  const readAll = () => {
    try {
      return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch {
      return { apps: {} };
    }
  };
  return {
    path: file,
    get: (app) => readAll().apps?.[app] || null,
    set(app, account) {
      assertAccountStoreIgnored(file);
      const data = readAll();
      data.apps = { ...(data.apps || {}), [app]: account };
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, { mode: 0o600 });
      return account;
    },
  };
}

// Mật khẩu phải qua được các validator về độ mạnh nên trộn hoa/thường/số/ký hiệu
function generatePassword() {
  const body = crypto.randomBytes(9).toString('base64url').replace(/[^A-Za-z0-9]/g, '');
  return `Ev${body}#7rq`;
}

function resolveApp(config, app) {
  const name = app || config.defaultApp;
  const appConfig = config.apps?.[name];
  if (!appConfig) throw new Error(`App "${name}" chưa được khai báo trong cấu hình dự án`);
  return { name, appConfig, baseUrl: process.env.BASE_URL || appConfig.baseUrl };
}

async function launchBrowser(settings) {
  const { headed, browserChannel, viewport } = settings.recording;
  return chromium.launch({
    headless: !headed,
    channel: browserChannel,
    args: headed ? ['--window-position=0,0', `--window-size=${viewport.width},${viewport.height + 120}`] : [],
  });
}

// Dự án tự dựng môi trường trước khi mở trình duyệt: màn hình lỗi của môi trường lọt vào
// evidence sẽ làm nó vô dụng. Trả về danh sách những gì đã sửa để in cho người dùng.
async function prepareApp({ appConfig, name, baseUrl }) {
  if (typeof appConfig.prepare !== 'function') return [];
  const result = await appConfig.prepare({ app: name, baseUrl, exec: execFileSync, root: ROOT });
  return Array.isArray(result) ? result : [];
}

async function signIn({ browser, appConfig, name, baseUrl, settings }) {
  if (typeof appConfig.login !== 'function') return undefined;
  const store = makeAccountStore(settings.output.accountStore);
  return appConfig.login({
    browser, app: name, baseUrl, viewport: settings.recording.viewport,
    store, generatePassword, exec: execFileSync,
  });
}

// Lỗi JS và request hỏng là thứ hay làm kịch bản gãy mà thông báo timeout của Playwright
// không nói ra. Gom lại để khi có sự cố thì biết ngay là do selector hay do app đang lỗi.
function watchProblems(page) {
  const problems = [];
  page.on('console', (msg) => {
    if (['error', 'warning'].includes(msg.type())) {
      problems.push(`[console.${msg.type()}] ${msg.text()}`.slice(0, 300));
    }
  });
  page.on('pageerror', (err) => problems.push(`[pageerror] ${String(err.message).slice(0, 300)}`));
  page.on('response', (res) => {
    if (res.status() >= 400) problems.push(`[http ${res.status()}] ${res.url().slice(0, 200)}`);
  });
  return problems;
}

// Phiên dùng cho việc dò selector: không quay, chỉ cần một trang đã đăng nhập.
async function openSession({ config, app }) {
  const settings = resolveSettings(config);
  const { name, appConfig, baseUrl } = resolveApp(config, app);
  const fixes = await prepareApp({ appConfig, name, baseUrl });
  const browser = await launchBrowser(settings);
  const storageState = await signIn({ browser, appConfig, name, baseUrl, settings });
  const context = await browser.newContext({
    viewport: settings.recording.viewport,
    locale: settings.recording.locale,
    storageState,
  });
  const page = await context.newPage();
  const problems = watchProblems(page);
  return { browser, context, page, baseUrl, app: name, storageState, fixes, config, settings, problems };
}

async function closeSession(session) {
  await session.context.close();
  await session.browser.close();
}

module.exports = {
  VIEWPORT, ROOT, SKILL_DIR, HELP_ENV, sleep, watchProblems, assertOutsideSkill, resolveSettings,
  loadProjectConfig, makeAccountStore, generatePassword,
  resolveApp, launchBrowser, prepareApp, signIn,
  openSession, closeSession,
};
