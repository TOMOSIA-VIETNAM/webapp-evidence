// Gộp cấu hình dự án với mặc định của skill.
//
// Cấu hình chia theo scope để về sau thêm nhóm mới mà không đụng nhóm cũ:
//   apps      — mỗi app: baseUrl, prepare, login
//   recording — mọi thứ ảnh hưởng tới bản quay (khung hình, nhịp, chất lượng video)
//   output    — kết quả đi đâu và xử lý bản cũ thế nào
//
// Khoá đặt ở gốc (locale, accountStore, browserChannel) vẫn được chấp nhận để cấu hình viết theo
// bản trước không gãy; scope mới thắng khi cả hai cùng có.
const { LOCALE_KEYS, assertLocale } = require('./captions');

const DEFAULTS = {
  recording: {
    viewport: { width: 1280, height: 800 },
    locale: 'en-US',
    // Câu chú thích hiện trong video ở những chỗ bản quay không tự nói ra được (menu <select>,
    // hộp chọn file — do hệ điều hành vẽ nên không lọt vào khung hình). `locale` là ngôn ngữ
    // người review MR đọc, không phải ngôn ngữ của app.
    captions: { enabled: true, locale: 'en' },
    browserChannel: 'chrome',
    headed: false,
    // Tốc độ thao tác trong video. Nhận tên bậc ('slowest' | 'slow' | 'normal' | 'fast') hoặc
    // một số hiểu như tốc độ phát của trình xem video: 1 = bình thường, 0.5 = chậm một nửa,
    // 1.5 = nhanh gấp rưỡi. Số lớn hơn luôn là nhanh hơn, đúng như tên khoá.
    speed: 'normal',
    // Nhịp dành cho người xem, không phải cho máy. Chậm hơn thao tác thật vì người xem cần kịp
    // thấy chuột đi tới đâu rồi mới thấy kết quả.
    pace: {
      // Con trỏ: thời gian di chuyển tính theo khoảng cách và độ lớn của đích (định luật
      // Fitts) chứ không cố định, nên ở đây khai hệ số chứ không khai số bước.
      cursorFrameMs: 16,      // khoảng giữa hai khung hình khi vẽ đường đi
      cursorBaseMs: 90,       // phần cố định của một cú di chuyển
      cursorPerBitMs: 95,     // cộng thêm cho mỗi bậc khó của cú đó (đích càng nhỏ, càng xa)
      cursorMinMs: 120,       // rê sang phần tử ngay bên cạnh cũng không nhanh hơn mức này
      cursorMaxMs: 900,       // vượt cả màn hình cũng không lâu hơn mức này
      cursorSettleMs: 110,    // chỉnh lại sau khi vượt quá đích (chỉ có ở cú đi xa)
      beforeClickMs: 250,     // ngắm trước khi bấm; cú rê ngắn tự động ngắm nhanh hơn
      clickHoldMs: 85,        // giữ nút chuột
      afterClickQuickMs: 220, // pause: 'quick' — click chỉ để đi tiếp, không có gì phải xem
      afterClickMs: 800,      // pause mặc định (helper click có thể ghi đè từng lần)
      afterClickObserveMs: 1700, // pause: 'observe' — phải đọc kết quả trên màn hình
      typeCharMs: 75,         // thời gian trung bình mỗi ký tự khi gõ
      afterTypeMs: 700,
      selectStepMs: 220,      // thời gian mỗi lần đổi lựa chọn trong select
      afterSelectMs: 900,
      afterUploadMs: 1200,    // dừng để tên file kịp hiện lên
      beforeHotkeyMs: 450,    // bảng chú thích phím tắt hiện trước, rồi mới bấm phím
      hotkeyHoldMs: 1400,     // giữ bảng chú thích sau khi bấm, để đọc kịp cả phím và kết quả
      afterHotkeyMs: 900,     // dừng sau khi bảng chú thích tắt
      noteHoldMs: 2200,       // giữ câu chú thích đủ lâu để đọc hết
      settleMs: 600,          // chờ sau khi trang load xong, trước khi bắt đầu tính giờ
      tailMs: 900,            // giữ thêm ở cuối để khung hình cuối không bị cụt
      // Mọi quãng chờ ở trên bị rung quanh giá trị khai báo theo tỉ lệ này. Nhịp đều tăm tắp
      // là dấu hiệu rõ nhất của video do máy bấm. Đặt 0 khi cần hai bản quay khớp từng khung.
      jitter: 0.18,
    },
    video: { crf: 26, preset: 'slow' },
  },
  output: {
    // false: giữ bản quay cũ lại bằng cách dồn vào evidence/v1, v2… trước khi quay bản mới.
    // Bản quay là bằng chứng đã gửi đi kèm MR, ghi đè mất là mất luôn đối chiếu.
    overwrite: false,
    accountStore: '.evidence/accounts.json',
  },
};

// Giá trị là bội tốc độ, cùng thang với số người dùng tự điền
const SPEED_PRESETS = { slowest: 0.5, slow: 0.67, normal: 1, fast: 1.67 };
const SPEED_RANGE = { min: 0.2, max: 5 };

const isObject = (v) => v && typeof v === 'object' && !Array.isArray(v);

// speed co giãn mọi quãng thời gian trong pace. Số bước nội suy giữ nguyên vì nó quyết định
// đường chuột có mượt hay không, không phải nhanh hay chậm.
function speedToRate(speed) {
  if (typeof speed === 'number') {
    if (!Number.isFinite(speed) || speed < SPEED_RANGE.min || speed > SPEED_RANGE.max) {
      throw new Error(
        `recording.speed ngoài khoảng cho phép: ${speed}\n` +
        `Số phải trong ${SPEED_RANGE.min}–${SPEED_RANGE.max} (1 = bình thường, ` +
        '0.5 = chậm một nửa, 1.5 = nhanh gấp rưỡi).'
      );
    }
    return speed;
  }
  const rate = SPEED_PRESETS[speed];
  if (rate === undefined) {
    throw new Error(
      `recording.speed không hợp lệ: ${JSON.stringify(speed)}\n` +
      `Dùng tên bậc (${Object.keys(SPEED_PRESETS).join(' | ')}) ` +
      `hoặc một số trong ${SPEED_RANGE.min}–${SPEED_RANGE.max}, hiểu như tốc độ phát video.`
    );
  }
  return rate;
}

function applySpeed(pace, speed) {
  // Tốc độ gấp đôi nghĩa là mọi quãng chờ ngắn đi một nửa
  const factor = 1 / speedToRate(speed);
  if (factor === 1) return pace;
  const scaled = { ...pace };
  for (const [key, value] of Object.entries(pace)) {
    if (key.endsWith('Ms') && typeof value === 'number') scaled[key] = Math.round(value * factor);
  }
  return scaled;
}

function merge(base, override) {
  const out = { ...base };
  for (const [key, value] of Object.entries(override || {})) {
    if (value === undefined) continue;
    out[key] = isObject(value) && isObject(base[key]) ? merge(base[key], value) : value;
  }
  return out;
}

// Khoá cũ ở gốc bị khoá trong scope che thì giá trị người ta viết ra im lặng không có tác dụng —
// khó thấy nhất là khi scope được kế thừa qua spread từ cấu hình chung.
function warnShadowedLegacy(config) {
  const pairs = [
    ['locale', config.locale, config.recording?.locale, 'recording.locale'],
    ['browserChannel', config.browserChannel, config.recording?.browserChannel, 'recording.browserChannel'],
    ['accountStore', config.accountStore, config.output?.accountStore, 'output.accountStore'],
  ];
  for (const [key, rootValue, scopedValue, scopedName] of pairs) {
    if (rootValue !== undefined && scopedValue !== undefined && rootValue !== scopedValue) {
      console.warn(
        `CẢNH BÁO: cấu hình có cả \`${key}\` ở gốc (${JSON.stringify(rootValue)}) và ` +
        `\`${scopedName}\` (${JSON.stringify(scopedValue)}). Scope thắng, giá trị ở gốc bị bỏ qua.\n` +
        '  Kế thừa cấu hình chung bằng spread thì phải ghi đè trong scope: ' +
        `{ ...base, recording: { ...base.recording, ${key}: … } }`
      );
    }
  }
}

// Hai khoá này từng quyết định đường đi con trỏ (số bước × thời gian mỗi bước). Giờ thời gian
// di chuyển tính theo khoảng cách nên chúng không còn chỗ dùng — nói ra thay vì im lặng bỏ qua
// giá trị người ta đã cân nhắc để viết.
const REMOVED_PACE_KEYS = {
  cursorSteps: 'cursorFrameMs (khoảng giữa hai khung hình)',
  cursorStepMs: 'cursorFrameMs (khoảng giữa hai khung hình)',
};

function warnRemovedPaceKeys(config) {
  for (const [key, replacement] of Object.entries(REMOVED_PACE_KEYS)) {
    if (config.recording?.pace?.[key] === undefined) continue;
    console.warn(
      `CẢNH BÁO: \`recording.pace.${key}\` không còn tác dụng và bị bỏ qua.
` +
      '  Thời gian di chuyển con trỏ giờ tính theo khoảng cách và độ lớn của đích ' +
      `(cursorBaseMs, cursorPerBitMs, cursorMinMs, cursorMaxMs). Muốn đổi độ mượt thì dùng ${replacement}.`
    );
  }
}

// Bật/tắt qua biến môi trường: nhận cả cách viết mà người ta hay gõ, nhưng gõ sai thì báo lỗi
// thay vì âm thầm hiểu thành "tắt".
const SWITCH_ON = ['1', 'on', 'true', 'yes'];
const SWITCH_OFF = ['0', 'off', 'false', 'no'];

function parseSwitch(value) {
  const normalized = String(value).trim().toLowerCase();
  if (SWITCH_ON.includes(normalized)) return true;
  if (SWITCH_OFF.includes(normalized)) return false;
  throw new Error(
    `CAPTIONS không hợp lệ: ${JSON.stringify(value)}\n` +
    `Dùng ${SWITCH_ON.join('/')} để bật, ${SWITCH_OFF.join('/')} để tắt.`
  );
}

function resolveSettings(config) {
  warnShadowedLegacy(config);
  warnRemovedPaceKeys(config);
  const legacy = {
    recording: {
      locale: config.locale,
      browserChannel: config.browserChannel,
    },
    output: {
      accountStore: config.accountStore,
    },
  };

  // speed co giãn bộ mặc định trước, rồi pace do người dùng khai mới đè lên — giá trị họ tự viết
  // ra là giá trị tuyệt đối, không bị nhân thêm lần nữa.
  const speed = config.recording?.speed ?? DEFAULTS.recording.speed;
  const base = merge(DEFAULTS, {
    recording: { pace: applySpeed(DEFAULTS.recording.pace, speed) },
  });

  const settings = merge(merge(base, legacy), {
    recording: config.recording,
    output: config.output,
  });

  // Biến môi trường là quyết định của người đang chạy, thắng mọi cấu hình
  if (process.env.HEADED === '1') settings.recording.headed = true;
  if (process.env.BROWSER_CHANNEL) settings.recording.browserChannel = process.env.BROWSER_CHANNEL;
  if (process.env.EVIDENCE_OVERWRITE === '1') settings.output.overwrite = true;
  if (process.env.CAPTIONS) settings.recording.captions.enabled = parseSwitch(process.env.CAPTIONS);
  if (process.env.CAPTION_LOCALE) {
    settings.recording.captions.locale = assertLocale(process.env.CAPTION_LOCALE, 'CAPTION_LOCALE');
  }
  assertLocale(settings.recording.captions.locale, 'recording.captions.locale');

  return settings;
}

module.exports = { DEFAULTS, resolveSettings, LOCALE_KEYS };
