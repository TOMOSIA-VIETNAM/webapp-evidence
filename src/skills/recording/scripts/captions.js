// The caption sentences shown in the video, in the language of the MR reviewer.
//
// There are moments the recording cannot speak for itself, most clearly the widgets drawn by the
// operating system: the <select> dropdown and the file picker sit outside the page content, so
// they never make it into the frame. The viewer sees the value change without seeing why. The
// caption fills exactly that gap, and says outright that this part could not be recorded — a
// missing image is better than letting the viewer infer something wrong.
//
// This is the single source of every generated sentence. Adding a language means adding a key
// here, not scattering strings through the runner.
//
// Two audiences share the table, and they are not the same people. A caption is read by whoever
// reviews the merge request. A notice is read by whoever is sitting at the machine while it
// records — and it is shown whether or not captions are switched on, because turning captions
// off is a decision about the video, not about warning the person whose screen is about to be
// recorded.
//
// A builder is handed the facts, never a word: passing "accepted" for the caller to interpolate
// leaves an English word sitting in the middle of a Japanese sentence, and each language phrases
// the same fact its own way.
const LOCALES = {
  en: {
    label: 'English',
    selectOption: ({ value }) => `Selected "${value}". The dropdown menu is drawn by the operating system, so it does not appear in this recording.`,
    uploadFile: ({ file }) => `Chose "${file}" in the file picker. The picker is drawn by the operating system, so it does not appear in this recording.`,
    browserDialog: ({ accepted, message }) => `The browser asked: "${message}", and it was ${accepted ? 'accepted' : 'dismissed'}. The dialog is drawn by the browser itself, so it does not appear in this recording.`,
    screenCaptureConfirm: () => 'A recording of this screen has been requested.\n\nNothing is being recorded yet, and nothing will be until you say so. Press OK, then go back to the terminal where you asked for the evidence — the question is waiting there.',
    screenCaptureStarting: () => 'Ready to record this screen.\n\nTurn on Do Not Disturb so a notification cannot appear in the video, then press OK. Recording starts a few seconds after that, and the machine should be left alone until it finishes.',
  },
  ja: {
    label: '日本語',
    selectOption: ({ value }) => `「${value}」を選択しました。ドロップダウンはOSが描画するため、この録画には映りません。`,
    uploadFile: ({ file }) => `ファイル選択ダイアログで「${file}」を選択しました。ダイアログはOSが描画するため、この録画には映りません。`,
    browserDialog: ({ accepted, message }) => `ブラウザのダイアログ「${message}」が表示され、${accepted ? 'OK を押しました' : 'キャンセルしました'}。ダイアログはブラウザ自身が描画するため、この録画には映りません。`,
    screenCaptureConfirm: () => 'この画面の録画が要求されました。\n\nまだ録画は始まっていませんし、承諾するまで始まりません。OK を押してから、証跡を依頼したターミナルに戻ってください。そこに質問が出ています。',
    screenCaptureStarting: () => 'この画面を録画する準備ができました。\n\n通知が映り込まないよう集中モードをオンにしてから、OK を押してください。数秒後に録画が始まります。終わるまでこのマシンは操作しないでください。',
  },
  vi: {
    label: 'Tiếng Việt',
    selectOption: ({ value }) => `Đã chọn "${value}". Menu của <select> do hệ điều hành vẽ nên không lọt vào bản quay này.`,
    uploadFile: ({ file }) => `Đã chọn "${file}" trong hộp thoại chọn file. Hộp thoại do hệ điều hành vẽ nên không lọt vào bản quay này.`,
    browserDialog: ({ accepted, message }) => `Trình duyệt hỏi: "${message}", và đã ${accepted ? 'bấm OK' : 'bấm Cancel'}. Hộp thoại do chính trình duyệt vẽ nên không lọt vào bản quay này.`,
    screenCaptureConfirm: () => 'Có yêu cầu quay màn hình này.\n\nChưa quay gì cả, và sẽ không quay cho tới khi bạn đồng ý. Bấm OK rồi quay lại cửa sổ terminal nơi bạn yêu cầu lấy evidence — câu hỏi đang chờ ở đó.',
    screenCaptureStarting: () => 'Đã sẵn sàng quay màn hình này.\n\nHãy bật Do Not Disturb để thông báo không lọt vào video, rồi bấm OK. Vài giây sau sẽ bắt đầu quay, và đừng dùng máy cho tới khi quay xong.',
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

// A sentence for the person at the machine. Not routed through createCaptions, because that one
// answers null when captions are switched off, and a warning nobody sees is worse than no
// warning at all.
function noticeText(key, locale, params = {}) {
  const dict = LOCALES[assertLocale(locale, 'the notice language')];
  const build = dict[key];
  if (!build) throw new Error(`There is no notice for the key "${key}" in language ${locale}`);
  return build(params);
}

module.exports = { LOCALES, LOCALE_KEYS, assertLocale, createCaptions, noticeText };
