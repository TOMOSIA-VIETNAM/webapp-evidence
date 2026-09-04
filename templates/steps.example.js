// Kịch bản quay cho một màn hình. Đặt cạnh nơi lưu evidence của issue, ví dụ
// <thư mục evidence>/steps.js, rồi truyền đường dẫn file này cho record.js.
//
// mark() sinh ra timeline đi kèm video: mỗi mark là MỘT MỤC ĐÍCH (một cụm thao tác),
// không phải từng click. Người xem cần biết "đoạn này đang chứng minh cái gì".
const path = require('path');

module.exports = {
  app: 'admin',              // tên app khai báo trong evidence.config.js
  name: 'user-search',       // tên file video/timeline
  start: '/users',           // đường dẫn mở sau khi đăng nhập; thời gian load bị cắt khỏi video

  // Chỉ thao tác qua helper (click/type/select/upload). Gọi thẳng locator.click() hay
  // locator.setInputFiles() thì con trỏ không di chuyển tới đó và video mất mạch.
  async run({ page, mark, click, type, select, upload, hotkey, note, shot, sleep }) {
    mark('Mở màn danh sách');
    await sleep(1400);
    await shot('list');

    // `pause` nói mục đích của cú click, không phải số ms: 'quick' cho bước chỉ để đi tiếp,
    // 'observe' cho chỗ người xem phải đọc kết quả.
    mark('Nhập điều kiện lọc');
    await type(page.locator('#q_name_cont'), 'test');
    await select(page.locator('#q_status_eq'), 'Active');
    // Menu của <select> thuần không lọt vào video, nên chụp trạng thái sau khi chọn để bù
    await shot('filter-filled');

    mark('Chạy tìm kiếm');
    await click(page.getByRole('button', { name: 'Search' }).first(), { pause: 'observe' });
    await shot('result');

    mark('Đính kèm file');
    // select() và upload() tự hiện chú thích: menu và hộp thoại của chúng do hệ điều hành vẽ
    // nên không lọt vào khung hình, câu chú thích nói thay điều đó.
    await upload(page.locator('#import_file'), path.join(__dirname, 'sample.csv'));
    await shot('file-selected');

    // note() cho thứ chỉ người viết kịch bản mới biết là cần nói ra. Tắt cùng công tắc
    // CAPTIONS=off, và đừng dùng để thuyết minh thứ đã thấy rõ trên hình.
    await note('この行はシードデータで、この操作で作られたものではありません。', {
      target: page.locator('#user_row_1'),
    });

    mark('Sao chép mã rồi dán sang ô tìm kiếm');
    // Bàn phím không để lại dấu vết nào trên hình, nên hotkey() hiện bảng chú thích phím
    // cạnh phần tử đang thao tác. `label` viết theo ngôn ngữ người review MR đọc.
    // `ControlOrMeta` để kịch bản chạy được trên cả macOS và Windows/Linux.
    await hotkey('ControlOrMeta+A', { label: '全選択', target: page.locator('#q_name_cont') });
    await hotkey('ControlOrMeta+C', { label: 'コピー' });

    mark('Mở modal chi tiết rồi đóng lại');
    // Modal có animation dài hơn mức 'observe' nên chốt hẳn bằng số ms
    await click(page.getByRole('button', { name: 'Detail' }).first(), { pause: 4200 });
    await shot('detail-modal');
    // Modal giữ đủ lâu và đóng bằng nút thật trên UI: người xem cần thấy nút nào được bấm.
    // Chỉ dùng hotkey() khi chính phím tắt là thứ MR cần chứng minh, hoặc UI không có nút.
    await click(page.getByRole('button', { name: 'Close' }).first(), { pause: 2000 });
  },
};
