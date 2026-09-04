#!/usr/bin/env node
// Runner quay evidence cho MR: video thao tác + screenshot + timeline.
// Cách dùng: OUT_DIR=<thư mục> node record.js <steps-file>   (xem --help)
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const {
  HELP_ENV, sleep, watchProblems, assertOutsideSkill, resolveSettings,
  loadProjectConfig, resolveApp, launchBrowser, prepareApp, signIn,
} = require('./session');
const { createHuman } = require('./human');
const { createCaptions } = require('./captions');

const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

// Tên phím của Playwright ('ControlOrMeta+C') không phải thứ người xem đọc trên bàn phím của họ.
// Bảng chú thích trong video hiển thị đúng ký hiệu của hệ điều hành đang quay: máy Mac thấy ⌘,
// máy Windows/Linux thấy Ctrl.
const IS_MAC = process.platform === 'darwin';
const MODIFIER_CAPS = IS_MAC
  ? { Meta: '\u2318', ControlOrMeta: '\u2318', Control: '\u2303', Alt: '\u2325', Shift: '\u21e7' }
  : { Meta: 'Win', ControlOrMeta: 'Ctrl', Control: 'Ctrl', Alt: 'Alt', Shift: 'Shift' };
const NAMED_CAPS = {
  Escape: 'Esc', Enter: 'Enter', Tab: 'Tab', Backspace: 'Backspace', Delete: 'Delete',
  ArrowUp: '\u2191', ArrowDown: '\u2193', ArrowLeft: '\u2190', ArrowRight: '\u2192', Space: 'Space',
};

function keyCaps(keys) {
  return String(keys).split('+').map((raw) => {
    const key = raw.trim();
    if (!key) throw new Error(`Chuỗi phím tắt không hợp lệ: ${JSON.stringify(keys)}`);
    return MODIFIER_CAPS[key] || NAMED_CAPS[key] || (key.length === 1 ? key.toUpperCase() : key);
  });
}

function help() {
  console.log(`Quay evidence cho MR: video thao tác + screenshot + timeline.

  OUT_DIR=<thư mục> node record.js <steps-file>

    <steps-file>      Kịch bản của màn hình. Mẫu: ${path.join(__dirname, '../templates/steps.example.js')}
    OUT_DIR           Thư mục ghi kết quả (bắt buộc)
    VIDEO_NAME        Tên file video/runbook (mặc định lấy từ kịch bản)
    CAPTIONS          on|off — câu chú thích trong video (mặc định on)
    CAPTION_LOCALE    Ngôn ngữ chú thích: en | ja | vi (mặc định en)

${HELP_ENV}

Kết quả: <name>.mp4, <name>-runbook.md và các screenshot đánh số theo thứ tự chụp.
Phần chờ trang load ở đầu bị cắt khỏi video; bước đăng nhập không được quay.`);
}

// ---------- helper thao tác ----------
// Không phải cú click nào cũng có thứ để xem. Mở một tab, bung một menu, chuyển sang ô kế tiếp —
// người thật bấm liền tay rồi đi tiếp; chỉ khi kết quả hiện ra trên màn hình họ mới dừng đọc.
// Ba mức này để kịch bản nói ra ý đó thay vì rải số ms.
const PAUSE_LEVELS = {
  quick: 'afterClickQuickMs',      // chỉ là bước dẫn tới thao tác sau, không có gì phải xem
  normal: 'afterClickMs',          // mặc định
  observe: 'afterClickObserveMs',  // phải đọc kết quả trên màn hình
};

function resolvePause(pause, pace) {
  if (pause === undefined) return pace.afterClickMs;
  if (typeof pause === 'number') return pause;
  const key = PAUSE_LEVELS[pause];
  if (!key) {
    throw new Error(
      `pause không hợp lệ: ${JSON.stringify(pause)}\n` +
      `Dùng số ms, hoặc một trong ${Object.keys(PAUSE_LEVELS).join(' | ')}.`
    );
  }
  return pace[key];
}

// Chuột di chuyển nội suy rồi mới bấm, để người xem kịp thấy click rơi vào đâu
function buildContext(page, outDir, marks, hotkeys, notes, startedAt, pace, viewport, human, captions) {
  const mark = (label) => marks.push({ at: (Date.now() - startedAt) / 1000, label });
  const since = () => (Date.now() - startedAt) / 1000;

  // Mỗi lệnh move/keypress đi một vòng tới trình duyệt. Ngủ đủ `delay` SAU mỗi vòng thì thao
  // tác dài hơn ý định 30–40%, và đó chính là cảm giác "sao nó chờ lâu thế". Nên ngủ tới mốc
  // thời gian đã tính, không ngủ theo lượng.
  function scheduler() {
    const from = Date.now();
    let planned = 0;
    return async (delay) => {
      planned += delay;
      const behind = planned - (Date.now() - from);
      if (behind > 0) await sleep(behind);
    };
  }

  async function moveTo(x, y, targetSize) {
    const from = page.__cursor || human.restingPoint();
    const plan = human.movePlan(from, { x, y }, targetSize);
    page.__cursor = { x, y };
    if (!plan) return 0;

    // Nội suy theo đồng hồ thật: vẽ được bao nhiêu khung hình tuỳ độ nhanh của trình duyệt,
    // nhưng cú di chuyển luôn kết thúc đúng lúc đã định.
    const startedMove = Date.now();
    for (;;) {
      const frameAt = Date.now();
      const progress = (frameAt - startedMove) / plan.duration;
      if (progress >= 1) break;
      const point = plan.at(progress);
      await page.mouse.move(point.x, point.y);
      const idle = plan.frameMs - (Date.now() - frameAt);
      if (idle > 0) await sleep(idle);
    }
    await page.mouse.move(x, y);
    return Math.hypot(x - from.x, y - from.y);
  }

  async function click(locator, { pause } = {}) {
    // scrollIntoViewIfNeeded tốn khoảng 64ms mỗi lần gọi. Phần tử đã nằm trong khung hình thì
    // bỏ qua: chuỗi click trong cùng một màn hình mới không bị chậm đi vì việc không cần làm.
    let box = await locator.boundingBox();
    const inView = box
      && box.y >= 0 && box.y + box.height <= viewport.height
      && box.x >= 0 && box.x + box.width <= viewport.width;
    if (!inView) {
      await locator.scrollIntoViewIfNeeded();
      box = await locator.boundingBox();
    }
    if (!box) throw new Error('Phần tử cần click không hiển thị');
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    // Bấm không rơi vào đúng tâm: tay người đặt lệch tâm một chút, và phần tử càng lớn thì
    // chỗ bấm càng tản ra — vẫn luôn nằm trong phần tử.
    const spread = (size) => (size > 24 ? (human.rng() - 0.5) * Math.min(size * 0.3, 16) : 0);
    const tx = cx + spread(box.width);
    const ty = cy + spread(box.height);
    const dist = await moveTo(tx, ty, Math.min(box.width, box.height));
    await sleep(human.aimDelay(dist));
    await page.mouse.down();
    await sleep(human.wait(pace.clickHoldMs));
    await page.mouse.up();
    await sleep(human.wait(resolvePause(pause, pace)));
    // Sau khi điều hướng, con trỏ giả được vẽ lại từ vị trí mặc định nên phải đồng bộ lại
    await page.mouse.move(tx + 0.5, ty + 0.5);
  }

  // Bấm vào ô rồi gõ. Nhịp gõ không đều: chậm lại ở dấu cách và sau dấu câu, thỉnh thoảng
  // ngập ngừng — `delay` cố định của Playwright cho ra tiếng gõ đều như máy đánh chữ.
  async function type(locator, text) {
    await click(locator, { pause: 'quick' });
    const chars = Array.from(String(text));
    const delays = human.typeDelays(text);
    const keepPace = scheduler();
    for (let i = 0; i < chars.length; i++) {
      await page.keyboard.type(chars[i]);
      await keepPace(delays[i]);
    }
    await sleep(human.wait(pace.afterTypeMs));
  }

  // Menu bung của <select> là widget do hệ điều hành vẽ nên không lọt vào video.
  // Không tìm cách vẽ lại hay ép nó hiển thị trong trang: mọi cách đó đều phải sửa style của
  // element thật, làm bố cục trong video khác bố cục app thật — evidence mất giá trị.
  // Ở đây chỉ cho thấy tương tác (bấm vào ô, giá trị đổi dần) và đảm bảo chọn đúng giá trị.
  async function select(locator, label) {
    await click(locator, { pause: 'quick' });

    const options = await locator.locator('option').allTextContents();
    const target = options.findIndex((o) => o.trim() === label);
    if (target < 0) throw new Error(`Không tìm thấy lựa chọn: ${label}`);

    const current = await locator.evaluate((el) => el.selectedIndex);
    const key = target > current ? 'ArrowDown' : 'ArrowUp';
    for (let i = 0; i < Math.abs(target - current); i++) {
      await page.keyboard.press(key);
      await sleep(human.wait(pace.selectStepMs));
    }

    // Có môi trường phím mũi tên không đổi được lựa chọn; chốt lại bằng dữ liệu vì
    // hiển thị đẹp mà chọn sai thì evidence vô nghĩa
    if ((await locator.evaluate((el) => el.selectedIndex)) !== target) {
      await locator.selectOption({ label });
    }

    // Người xem thấy giá trị trong ô đổi nhưng không thấy menu nào mở ra, vì menu đó do hệ
    // điều hành vẽ. Câu chú thích nói ra điều đó thay vì để họ tự suy.
    const shown = await showNote(captions.text('selectOption', { value: label }), locator);
    await sleep(Math.max(human.wait(pace.afterSelectMs), shown ? pace.noteHoldMs : 0));
    if (shown) await hideCaption();
  }

  // Hộp thoại chọn file của hệ điều hành cũng không quay được. Nạp file trực tiếp rồi
  // dừng lại đủ lâu để thấy tên file hiện lên trong ô — đó mới là thứ chứng minh được.
  async function upload(locator, filePath) {
    await click(locator, { pause: 'quick' });
    await locator.setInputFiles(filePath);
    const shown = await showNote(captions.text('uploadFile', { file: path.basename(filePath) }), locator);
    await sleep(Math.max(human.wait(pace.afterUploadMs), shown ? pace.noteHoldMs : 0));
    if (shown) await hideCaption();
  }

  // boundingBox trả về {x, y, width, height}, còn phần vẽ chú thích tính chỗ đặt theo cạnh
  // (left/top/right/bottom) như DOMRect. Thiếu bốn cạnh này thì mọi so sánh ra NaN và bảng âm
  // thầm rơi xuống giữa đáy khung hình thay vì neo vào phần tử.
  async function edgesOf(locator) {
    const box = await locator.boundingBox();
    if (!box) return null;
    return {
      left: box.x, top: box.y, right: box.x + box.width, bottom: box.y + box.height,
      width: box.width, height: box.height,
    };
  }

  // Câu chú thích trong video. Trả về false khi chú thích đang tắt, để bên gọi biết là không
  // có gì phải chờ đọc.
  async function showNote(text, target) {
    if (!text) return false;
    const rect = target ? await edgesOf(target) : null;
    await page.evaluate((payload) => window.__evCaption?.note(payload), { text, rect });
    notes.push({ at: since(), text });
    return true;
  }

  const hideCaption = () => page.evaluate(() => window.__evCaption?.hide());

  // Chú thích do kịch bản tự viết, cho những chỗ chỉ người viết kịch bản mới biết là cần nói:
  // dữ liệu đến từ đâu, vì sao trạng thái này mới là đúng, thao tác vừa rồi bị OS che.
  //
  // Cũng tắt theo công tắc chung: người chạy đã nói "bản quay này không có chú thích" thì không
  // có cái nào lọt ra, kể cả cái kịch bản gọi thẳng. Một công tắc, một kết quả đoán được.
  async function note(text, { target, hold = pace.noteHoldMs } = {}) {
    if (!captions.enabled) return;
    if (!(await showNote(text, target))) return;
    await sleep(human.wait(hold));
    await hideCaption();
  }

  // Thao tác bằng bàn phím không để lại dấu vết nào trên hình: chuột đứng im, không có ripple,
  // người xem chỉ thấy nội dung tự đổi và không biết vì sao. Nên mỗi lần bấm phím tắt đều hiện
  // bảng chú thích ngay cạnh phần tử đang thao tác, giữ đủ lâu để đọc cả phím và kết quả.
  async function hotkey(keys, { label, target, pause = pace.afterHotkeyMs, hold = pace.hotkeyHoldMs } = {}) {
    const waitFor = (ms) => sleep(human.wait(ms));
    const caps = keyCaps(keys);

    // Có target thì bấm vào đó trước: người xem thấy phím tắt đang áp lên phần tử nào, và
    // bảng chú thích neo được vào đúng phần tử đó thay vì rơi xuống đáy khung hình.
    let rect = null;
    if (target) {
      await click(target, { pause: 'quick' });
      rect = await edgesOf(target);
    }

    await page.evaluate((payload) => window.__evCaption?.keys(payload), { caps, label, rect });
    await waitFor(pace.beforeHotkeyMs);
    hotkeys.push({ at: (Date.now() - startedAt) / 1000, keys: caps.join(' + '), label });
    await page.keyboard.press(keys);
    await waitFor(hold);
    await hideCaption();
    await waitFor(pause);
  }

  let shotIndex = 0;
  async function shot(name) {
    shotIndex += 1;
    const file = path.join(outDir, `${String(shotIndex).padStart(2, '0')}-${name}.png`);
    await page.screenshot({ path: file });
    return file;
  }

  return { page, mark, click, type, select, upload, hotkey, note, shot, sleep, moveTo };
}

// Timeline không xuất thành file riêng: nó nằm trong runbook để chỉ có một chỗ phải sửa.
function buildTimeline(marks, trimAt, duration) {
  const rows = marks
    .map((m, i) => ({
      from: Math.max(0, m.at - trimAt),
      to: (marks[i + 1]?.at ?? trimAt + duration) - trimAt,
      label: m.label,
    }))
    .filter((r) => r.to - r.from > 0.4);
  return rows.map((r) => `${fmt(r.from)} - ${fmt(r.to)}  ${r.label}`).join('\n');
}

// Phím tắt là thao tác duy nhất người xem có thể bỏ sót dù bảng chú thích chỉ hiện hơn một giây,
// nên liệt kê kèm mốc thời gian để tua lại đúng chỗ. Không có phím tắt thì không sinh mục này.
function buildHotkeySection(hotkeys, trimAt) {
  if (!hotkeys.length) return '';
  const rows = hotkeys.map((h) => {
    const at = fmt(Math.max(0, h.at - trimAt));
    return `- ${at}  \`${h.keys}\`${h.label ? ` — ${h.label}` : ''}`;
  });
  return `## Phím tắt trong video\n\n${rows.join('\n')}\n\n`;
}

// Chú thích ghi lại cả ở đây vì phần lớn chúng nói về thứ bản quay KHÔNG chứa (menu <select>,
// hộp chọn file). Người đọc runbook cần thấy danh sách đó mà không phải xem lại video.
function buildNoteSection(notes, trimAt) {
  if (!notes.length) return '';
  const rows = notes.map((n) => `- ${fmt(Math.max(0, n.at - trimAt))}  ${n.text}`);
  return `## Chú thích hiện trong video\n\n${rows.join('\n')}\n\n`;
}

function encodeMp4(outDir, name, webm, trimAt, video) {
  const mp4 = path.join(outDir, `${name}.mp4`);
  execFileSync('ffmpeg', [
    '-y', '-v', 'error', '-ss', String(trimAt), '-i', webm,
    '-c:v', 'libx264', '-preset', video.preset, '-crf', String(video.crf),
    '-pix_fmt', 'yuv420p', '-movflags', '+faststart', mp4,
  ]);
  fs.unlinkSync(webm);
  return mp4;
}

// Kết quả quay là file nặng và sinh lại được, không thuộc về lịch sử của repo. Chỗ lưu phải là
// vùng ĐÃ ignore — không chỉ untracked: `git add -A` nuốt sạch file untracked, và một video lọt
// vào commit thì phải viết lại lịch sử mới gỡ ra được.
//
// Skill không tự sửa .gitignore của dự án (đó là sửa repo người khác cho việc phụ trợ), nhưng đưa
// sẵn dòng cần thêm để người dùng chỉ việc dán.
function gitTop() {
  try {
    return execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
}

function isTracked(dir) {
  try {
    const out = execFileSync('git', ['ls-files', '--', dir], { encoding: 'utf8' });
    return out.trim().length > 0;
  } catch {
    return false;
  }
}

function ignoreHints(outDir, top) {
  const rel = path.relative(top, path.resolve(outDir)).split(path.sep).join('/');
  const hints = [`${rel}/`];
  // Thư mục evidence nằm trong từng thư mục issue thì một dòng pattern gọn hơn là thêm từng issue
  const parts = rel.split('/');
  const idx = parts.lastIndexOf('evidence');
  if (idx > 0) hints.push(`${parts[0]}/**/evidence/`);
  return hints;
}

function assertIgnoredByGit(outDir) {
  if (process.env.EVIDENCE_ALLOW_TRACKED === '1') return;
  const top = gitTop();
  if (!top) return; // không phải git repo: không phải việc của skill

  try {
    execFileSync('git', ['check-ignore', '-q', outDir], { stdio: 'ignore' });
    return; // đã ignore
  } catch (e) {
    if (e.status !== 1) return; // git lỗi vì lý do khác: bỏ qua
  }

  const tracked = isTracked(outDir);
  const state = tracked
    ? 'đang được git theo dõi — file quay sẽ đi thẳng vào commit tiếp theo'
    : 'chưa được ignore — `git add -A` sẽ nuốt cả video và ảnh vào commit';

  throw new Error(
    `OUT_DIR ${state}:\n  ${path.resolve(outDir)}\n\n` +
    'Nhờ người dùng thêm một trong các dòng sau vào .gitignore rồi chạy lại:\n' +
    ignoreHints(outDir, top).map((h) => `  ${h}`).join('\n') + '\n\n' +
    'Skill không tự sửa .gitignore. Người dùng đã cân nhắc và vẫn muốn ghi vào đây thì đặt ' +
    'EVIDENCE_ALLOW_TRACKED=1.'
  );
}

// Bản quay là bằng chứng đã gửi kèm MR; ghi đè là mất luôn cái để đối chiếu khi có tranh cãi.
// Mặc định dồn kết quả cũ vào evidence/v1, v2… rồi mới quay bản mới vào thư mục gốc.
// Kịch bản, fixture và cấu hình không phải kết quả nên giữ nguyên chỗ.
function runArtifacts(outDir, name) {
  return fs.readdirSync(outDir).filter((f) => (
    /^\d{2}-.*\.png$/.test(f)
    || f === '99-full-page.png'
    || [`${name}.mp4`, `${name}.webm`, `${name}-runbook.md`, `${name}-console.log`].includes(f)
  ));
}

function archivePreviousRun(outDir, name, overwrite) {
  const existing = runArtifacts(outDir, name);
  if (!existing.length) return null;

  if (overwrite) {
    existing.forEach((f) => fs.unlinkSync(path.join(outDir, f)));
    return null;
  }

  const used = fs.readdirSync(outDir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && /^v\d+$/.test(e.name))
    .map((e) => Number(e.name.slice(1)));
  const version = (used.length ? Math.max(...used) : 0) + 1;

  const dir = path.join(outDir, `v${version}`);
  fs.mkdirSync(dir, { recursive: true });
  existing.forEach((f) => fs.renameSync(path.join(outDir, f), path.join(dir, f)));
  console.log(`ARCHIVED: bản quay trước chuyển vào ${dir}`);
  return dir;
}

// Đường dẫn tương đối chỉ dễ đọc khi nó thật sự ngắn hơn; kết quả nằm ngoài thư mục đang đứng
// mà in ra một chuỗi ../../.. thì tuyệt đối lại rõ hơn.
function displayPath(target) {
  const abs = path.resolve(target);
  const rel = path.relative(process.cwd(), abs);
  return rel && !rel.startsWith('..') ? rel : abs;
}

const humanSize = (bytes) => (bytes >= 1024 * 1024
  ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
  : `${Math.round(bytes / 1024)} KB`);

function dirSize(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).reduce((sum, entry) => {
    const full = path.join(dir, entry.name);
    return sum + (entry.isDirectory() ? dirSize(full) : fs.statSync(full).size);
  }, 0);
}

// Người dùng cần biết chính xác file nào vừa sinh ra để mở xem và đính lên MR. Các bản cũ được
// giữ lại là có chủ đích, nhưng giữ mãi thì thư mục phình — nên nói luôn chúng chiếm bao nhiêu và
// cách bỏ, thay vì để họ tự phát hiện sau vài tháng.
function reportResult(outDir, name, mp4, runbook, shots, durationSeconds) {
  const rel = displayPath;
  console.log('');
  console.log(`VIDEO:   ${rel(mp4)}  (${durationSeconds.toFixed(1)}s, ${humanSize(fs.statSync(mp4).size)})`);
  console.log(`RUNBOOK: ${rel(runbook)}`);
  console.log(`ẢNH:     ${shots.length} tấm trong ${rel(outDir)}`);

  const olds = fs.readdirSync(outDir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && /^v\d+$/.test(e.name))
    .map((e) => e.name)
    .sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)));

  if (!olds.length) return;

  const sizes = olds.map((v) => `${v} (${humanSize(dirSize(path.join(outDir, v)))})`);
  console.log('');
  console.log(`BẢN CŨ:  ${sizes.join(', ')}`);
  console.log(`  Không cần đối chiếu nữa thì xoá: rm -rf ${olds.map((v) => rel(path.join(outDir, v))).join(' ')}`);
}

// Bản mô tả để chạy lại lần sau mà không phải dò lại màn hình từ đầu.
function writeRunbook(outDir, name, meta) {
  const file = path.join(outDir, `${name}-runbook.md`);
  const rel = displayPath;
  const body = `---
name: ${name}
app: ${meta.app}
base_url: ${meta.baseUrl}
start_path: ${meta.start}
captions: ${meta.captions}
config: ${rel(meta.configFile)}
steps: ${rel(meta.stepsFile)}
video: ${rel(meta.video)}
duration_seconds: ${meta.duration.toFixed(1)}
recorded_at: ${meta.recordedAt}
---

# Runbook — ${name}

## Chạy lại

\`\`\`bash
OUT_DIR=${rel(outDir)} node ${rel(meta.runner)} ${rel(meta.stepsFile)}
\`\`\`

Kịch bản, cấu hình và tài khoản đều đã cố định, nên lệnh trên tái tạo đúng bản quay này.
Sửa nội dung quay thì sửa \`${rel(meta.stepsFile)}\`, không sửa file runbook.

## Các bước trong video

${meta.timeline}

${meta.hotkeySection}${meta.noteSection}## Ảnh chụp

${meta.shots.length ? meta.shots.map((f) => `- ${f}`).join('\n') : '- (không có)'}

## Môi trường

${meta.fixes.length ? meta.fixes.map((f) => `- đã tự sửa: ${f}`).join('\n') : '- không phải sửa gì'}

## Lỗi trang ghi nhận khi quay

${meta.problems.length ? meta.problems.slice(0, 20).map((p) => `- ${p}`).join('\n') : '- không có'}
`;
  fs.writeFileSync(file, body);
  return file;
}

// ---------- chạy ----------
async function main() {
  const stepsPath = process.argv[2];
  if (['--help', '-h'].includes(stepsPath) || !stepsPath) {
    help();
    process.exit(stepsPath ? 0 : 1);
  }
  const steps = require(path.resolve(stepsPath));

  const stepsFile = path.resolve(stepsPath);
  const { file: configFile, config } = loadProjectConfig(path.dirname(stepsFile));
  const settings = resolveSettings(config);
  const { pace, viewport, video: videoOpts } = settings.recording;
  const { name: app, appConfig, baseUrl } = resolveApp(config, steps.app);

  const outDir = process.env.OUT_DIR;
  if (!outDir) throw new Error('Phải truyền OUT_DIR');
  assertOutsideSkill(outDir, 'OUT_DIR');
  assertOutsideSkill(stepsFile, 'Kịch bản');
  assertIgnoredByGit(outDir);
  const name = process.env.VIDEO_NAME || steps.name || 'evidence';
  fs.mkdirSync(outDir, { recursive: true });

  archivePreviousRun(outDir, name, settings.output.overwrite);

  const fixes = await prepareApp({ appConfig, name: app, baseUrl });
  const browser = await launchBrowser(settings);

  // Đăng nhập ở context riêng, không quay: người xem không cần thấy bước này và
  // video cũng không được để lộ thông tin đăng nhập
  const storageState = await signIn({ browser, appConfig, name: app, baseUrl, settings });

  const context = await browser.newContext({
    viewport,
    locale: settings.recording.locale,
    deviceScaleFactor: 1,
    storageState,
    // App đặt Content-Security-Policy chặt sẽ chặn phần style của con trỏ; con trỏ chỉ là lớp
    // phủ phục vụ quay hình, không phải thứ đang được kiểm chứng, nên bỏ qua CSP ở đây.
    bypassCSP: true,
    recordVideo: { dir: outDir, size: viewport },
  });
  await context.addInitScript({ path: path.join(__dirname, 'cursor.js') });
  await context.addInitScript({ path: path.join(__dirname, 'caption.js') });
  const page = await context.newPage();
  const problems = watchProblems(page);

  const startedAt = Date.now();
  const marks = [];
  const hotkeys = [];
  const notes = [];
  const captions = createCaptions(settings.recording.captions);

  // Hạt giống lấy từ tên kịch bản: nhịp lệch của một kịch bản giống nhau qua mọi lần quay, nên
  // runbook vẫn giữ được lời hứa chạy lại ra đúng bản này.
  const human = createHuman({ pace, viewport, seed: name });

  // Thời gian chờ trang load bị cắt khỏi video
  await page.goto(`${baseUrl}${steps.start || '/'}`, { waitUntil: 'networkidle' });
  await sleep(pace.settleMs);

  // Đặt con trỏ vào một chỗ lệch tâm trước khi video bắt đầu. Không làm thì khung hình đầu có
  // con trỏ đứng đúng giữa màn hình rồi cú di chuyển đầu tiên xuất phát từ đó — không ai để
  // chuột ở giữa màn hình.
  const resting = human.restingPoint();
  await page.mouse.move(resting.x, resting.y);
  page.__cursor = resting;

  const trimAt = (Date.now() - startedAt) / 1000;

  const ctx = buildContext(
    page, outDir, marks, hotkeys, notes, startedAt, pace, viewport, human, captions
  );
  ctx.baseUrl = baseUrl;
  await steps.run(ctx);

  await sleep(pace.tailMs);
  const total = (Date.now() - startedAt) / 1000;
  const video = page.video();
  await context.close();

  // Ảnh fullPage phải chụp ngoài context đang quay, vì thao tác cuộn trang sẽ lọt vào video
  if (steps.fullPageShot !== false) {
    const shotContext = await browser.newContext({ viewport, locale: settings.recording.locale, storageState });
    const shotPage = await shotContext.newPage();
    await shotPage.goto(`${baseUrl}${steps.fullPageShot || steps.start || '/'}`, { waitUntil: 'networkidle' });
    await shotPage.screenshot({ path: path.join(outDir, '99-full-page.png'), fullPage: true });
    await shotContext.close();
  }
  await browser.close();

  const webm = path.join(outDir, `${name}.webm`);
  fs.renameSync(await video.path(), webm);
  const mp4 = encodeMp4(outDir, name, webm, trimAt, videoOpts);
  const timeline = buildTimeline(marks, trimAt, total - trimAt);

  // Chỉ sinh file log khi thật sự có lỗi, để thư mục evidence không bị rác
  let problemFile = null;
  if (problems.length) {
    problemFile = path.join(outDir, `${name}-console.log`);
    fs.writeFileSync(problemFile, `${problems.join('\n')}\n`);
  }

  const shots = fs.readdirSync(outDir).filter((f) => f.endsWith('.png')).sort();
  const runbook = writeRunbook(outDir, name, {
    app, baseUrl, start: steps.start || '/', configFile, stepsFile, video: mp4,
    captions: captions.enabled ? captions.locale : 'off',
    duration: total - trimAt, recordedAt: new Date().toISOString(),
    runner: __filename, timeline, hotkeySection: buildHotkeySection(hotkeys, trimAt),
    noteSection: buildNoteSection(notes, trimAt), shots, fixes, problems,
  });

  fixes.forEach((f) => console.log(`FIXED: ${f}`));
  console.log(timeline);
  if (problemFile) {
    console.log('');
    console.log(`PROBLEMS: ${problems.length} lỗi trang — xem ${path.relative(process.cwd(), problemFile)}`);
  }
  reportResult(outDir, name, mp4, runbook, shots, total - trimAt);
}

// Chỉ tự chạy khi được gọi thẳng; require vào thì chỉ lấy hàm (dùng khi kiểm thử)
if (require.main === module) {
  main().catch((e) => {
    console.error(String((e && e.message) || e));
    process.exit(1);
  });
}

// buildContext lộ ra để đo nhịp thao tác thật (thời gian mỗi helper chiếm) mà không phải quay
// cả một video; phần còn lại là hộp đen.
module.exports = { main, buildContext, archivePreviousRun, reportResult, runArtifacts };
