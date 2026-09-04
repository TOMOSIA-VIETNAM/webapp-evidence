// Cấu hình evidence của dự án. Runner (skill get-evidence) không biết gì về app cụ thể —
// mọi thứ riêng của dự án nằm ở đây.
//
// Đặt ở đâu:
//   - Cấu hình chung: <thư mục evidence của dự án>/evidence.config.js
//   - Cấu hình riêng một issue: đặt cạnh kịch bản, require cấu hình chung rồi ghi đè phần cần đổi
//     Ghi đè phải nằm đúng trong scope, vì spread nông giữ nguyên scope của cấu hình chung:
//     const base = require('../../evidence/evidence.config.js');
//     module.exports = { ...base, recording: { ...base.recording, speed: 'slow' } };
const { execFileSync } = require('child_process');

module.exports = {
  // App mặc định khi kịch bản không khai báo `app`
  defaultApp: 'admin',

  // Mọi thứ ảnh hưởng tới bản quay.
  recording: {
    locale: 'en-US',

    // Tốc độ thao tác trong video, hiểu như tốc độ phát của trình xem video:
    // số lớn hơn = nhanh hơn. Dùng tên bậc cho gọn, hoặc số nếu muốn mức riêng.
    //   'slowest' (0.5×) | 'slow' (0.67×) | 'normal' (1×) | 'fast' (1.67×)
    //   hoặc số trong 0.2–5, ví dụ 0.8 để chậm hơn bình thường một chút
    speed: 'normal',

    // viewport: { width: 1280, height: 800 },
    // browserChannel: 'chrome',
    // headed: false,
    // video: { crf: 26, preset: 'slow' },

    // Muốn chỉnh riêng từng loại thao tác (chờ sau khi bấm, tốc độ gõ phím…) thì khai `pace`.
    // Danh sách khoá và giá trị mặc định nằm ở lib/settings.js. Phần lớn trường hợp chỉ cần
    // `speed` ở trên, không cần đụng tới đây.
    // pace: { afterClickMs: 1200 },
  },

  output: {
    // false (mặc định): bản quay cũ được dồn vào evidence/v1, v2… trước khi quay bản mới,
    // vì evidence đã gửi kèm MR mà ghi đè là mất luôn cái để đối chiếu.
    // true: xoá bản cũ rồi quay đè.
    overwrite: false,

    // Nơi nhớ tài khoản đã dùng để quay. Bắt buộc nằm trong vùng đã gitignore vì chứa mật khẩu.
    accountStore: '.evidence/accounts.json',
  },

  apps: {
    admin: {
      baseUrl: 'http://localhost:3000',

      // Dựng môi trường trước khi mở trình duyệt. Trả về mảng mô tả những gì đã sửa
      // để runner in ra cho người dùng biết. Ném lỗi nếu không thể tự sửa.
      async prepare() {
        const fixed = [];
        // Ví dụ: khởi động server, cài dependency còn thiếu, đợi build xong…
        return fixed;
      },

      // Đăng nhập ở context riêng (không quay) rồi trả storageState cho context có quay.
      // `store` giữ tài khoản giữa các lần chạy; `generatePassword` sinh mật khẩu đủ mạnh.
      async login({ browser, app, baseUrl, viewport, store, generatePassword }) {
        let account = store.get(app);
        if (!account) {
          // Tự lấy một tài khoản sẵn có của môi trường dev và đặt mật khẩu cho việc quay,
          // để lần sau không phải hỏi lại người dùng.
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
