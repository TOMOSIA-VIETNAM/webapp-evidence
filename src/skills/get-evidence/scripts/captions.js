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
    `Invalid caption language (${source}): ${JSON.stringify(locale)}\n` +
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
