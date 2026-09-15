// The caption sentences shown in the video, in the language of the MR reviewer.
//
// There are moments the recording cannot speak for itself, most clearly the widgets drawn by the
// operating system: the <select> dropdown and the file picker sit outside the page content, so
// they never make it into the frame. The viewer sees the value change without seeing why. The
// caption fills exactly that gap, and says outright that this part could not be recorded — a
// missing image is better than letting the viewer infer something wrong.
//
// This is the single source of every generated caption. Adding a language means adding a key
// here, not scattering strings through the runner.
//
// A caption goes into the video, so its language is the merge request reviewer's and the list
// of languages is fixed: the runner has to be able to write one at a moment nobody is watching.
// A sentence shown to whoever is sitting at the machine is the opposite case — one person, one
// moment, and an agent already talking to them in whatever language they use — so those are
// written by the caller and are not here. See scripts/announce.js.
//
// A builder is handed the facts, never a word: passing "accepted" for the caller to interpolate
// leaves an English word sitting in the middle of a Japanese sentence, and each language phrases
// the same fact its own way.
const LOCALES = {
  en: {
    label: 'English',
    selectOption: ({ value }) => `Selected "${value}". The dropdown menu is drawn by the operating system, so it does not appear in this recording.`,
    uploadFile: ({ file }) => `Attached "${file}". The file is set on the field directly, so no picker opens — there is nothing missing from the recording here.`,
    browserDialog: ({ accepted, message }) => `The browser asked: "${message}", and it was ${accepted ? 'accepted' : 'dismissed'}. The dialog is drawn by the browser itself, so it does not appear in this recording.`,
  },
  ja: {
    label: '日本語',
    selectOption: ({ value }) => `「${value}」を選択しました。ドロップダウンはOSが描画するため、この録画には映りません。`,
    uploadFile: ({ file }) => `「${file}」を添付しました。ファイルはフィールドに直接設定されるため、選択ダイアログは開きません。録画から欠けているものはありません。`,
    browserDialog: ({ accepted, message }) => `ブラウザのダイアログ「${message}」が表示され、${accepted ? 'OK を押しました' : 'キャンセルしました'}。ダイアログはブラウザ自身が描画するため、この録画には映りません。`,
  },
  vi: {
    label: 'Tiếng Việt',
    selectOption: ({ value }) => `Đã chọn "${value}". Menu của <select> do hệ điều hành vẽ nên không lọt vào bản quay này.`,
    uploadFile: ({ file }) => `Đã đính kèm "${file}". File được gán thẳng vào field nên không có hộp thoại nào mở ra — chỗ này không thiếu gì trong bản quay.`,
    browserDialog: ({ accepted, message }) => `Trình duyệt hỏi: "${message}", và đã ${accepted ? 'bấm OK' : 'bấm Cancel'}. Hộp thoại do chính trình duyệt vẽ nên không lọt vào bản quay này.`,
  },
};

const LOCALE_KEYS = Object.keys(LOCALES);

function assertLocale(locale, source) {
  if (LOCALES[locale]) return locale;
  throw new Error(
    `Invalid language (${source}): ${JSON.stringify(locale)}\n` +
    `Use one of: ${LOCALE_KEYS.map((k) => `${k} (${LOCALES[k].label})`).join(', ')}.`
  );
}

// The sentence builder for one take. With `enabled: false` it returns null for every key, and the
// runner reads that as showing nothing — not as showing an empty overlay.
function createCaptions({ enabled, locale }) {
  const dict = LOCALES[assertLocale(locale, 'recording.captions.locale')];
  return {
    enabled: Boolean(enabled),
    locale,
    text(key, params = {}) {
      if (!enabled) return null;
      const build = dict[key];
      if (!build) throw new Error(`There is no caption sentence for the key "${key}" in language ${locale}`);
      return build(params);
    },
  };
}


module.exports = { LOCALES, LOCALE_KEYS, assertLocale, createCaptions };
