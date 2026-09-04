// Câu chú thích hiện trong video, theo ngôn ngữ của người review MR.
//
// Có những khoảnh khắc bản quay không tự nói ra được, rõ nhất là widget do hệ điều hành vẽ:
// menu của <select> và hộp chọn file nằm ngoài nội dung trang nên không lọt vào khung hình.
// Người xem thấy giá trị đổi mà không thấy vì sao. Câu chú thích lấp đúng khoảng trống đó, và
// nói thẳng rằng phần đó không quay được — thà thiếu hình còn hơn để người xem tự suy ra sai.
//
// Chỗ này là nguồn duy nhất của mọi câu chú thích tự sinh. Thêm ngôn ngữ thì thêm một khoá ở
// đây, không rải chuỗi trong runner.
const LOCALES = {
  en: {
    label: 'English',
    selectOption: ({ value }) => `Selected "${value}". The dropdown menu is drawn by the operating system, so it does not appear in this recording.`,
    uploadFile: ({ file }) => `Chose "${file}" in the file picker. The picker is drawn by the operating system, so it does not appear in this recording.`,
  },
  ja: {
    label: '日本語',
    selectOption: ({ value }) => `「${value}」を選択しました。ドロップダウンはOSが描画するため、この録画には映りません。`,
    uploadFile: ({ file }) => `ファイル選択ダイアログで「${file}」を選択しました。ダイアログはOSが描画するため、この録画には映りません。`,
  },
  vi: {
    label: 'Tiếng Việt',
    selectOption: ({ value }) => `Đã chọn "${value}". Menu của <select> do hệ điều hành vẽ nên không lọt vào bản quay này.`,
    uploadFile: ({ file }) => `Đã chọn "${file}" trong hộp thoại chọn file. Hộp thoại do hệ điều hành vẽ nên không lọt vào bản quay này.`,
  },
};

const LOCALE_KEYS = Object.keys(LOCALES);

function assertLocale(locale, source) {
  if (LOCALES[locale]) return locale;
  throw new Error(
    `Ngôn ngữ chú thích không hợp lệ (${source}): ${JSON.stringify(locale)}\n` +
    `Dùng một trong: ${LOCALE_KEYS.map((k) => `${k} (${LOCALES[k].label})`).join(', ')}.`
  );
}

// Bộ sinh câu cho một lần quay. `enabled: false` thì trả về null cho mọi khoá, và runner hiểu
// là không hiện gì — không phải hiện một bảng trống.
function createCaptions({ enabled, locale }) {
  const dict = LOCALES[assertLocale(locale, 'recording.captions.locale')];
  return {
    enabled: Boolean(enabled),
    locale,
    text(key, params = {}) {
      if (!enabled) return null;
      const build = dict[key];
      if (!build) throw new Error(`Không có câu chú thích cho khoá "${key}" ở ngôn ngữ ${locale}`);
      return build(params);
    },
  };
}

module.exports = { LOCALES, LOCALE_KEYS, assertLocale, createCaptions };
