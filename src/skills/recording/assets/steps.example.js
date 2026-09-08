// Step script for recording one screen. Put it next to where the issue's evidence is stored,
// for example <evidence dir>/steps.js, then pass this file's path to record.js.
//
// mark() produces the timeline that goes with the video: each mark is ONE PURPOSE (one group of
// actions), not one click per mark. The viewer needs to know "what is this stretch proving".
// Like every other caption, the mark text is written in the language the MR reviewer reads.
const path = require('path');

module.exports = {
  app: 'admin',              // name of the app declared in evidence.config.js
  name: 'user-search',       // file name of the video and the timeline
  start: '/users',           // path opened after login; the load time is cut out of the video

  // Only act through the helpers (click/type/select/upload). Calling locator.click() or
  // locator.setInputFiles() directly leaves the cursor where it was, and the video loses its thread.
  async run({ page, mark, click, type, select, upload, hotkey, note, shot, sleep }) {
    mark('一覧画面を開く');
    await sleep(1400);
    await shot('list');

    // `pause` states the purpose of the click, not a number of ms: 'quick' for a step that only
    // gets you to the next one, 'observe' where the viewer has to read the result.
    mark('検索条件を入力');
    await type(page.locator('#q_name_cont'), 'test');
    await select(page.locator('#q_status_eq'), 'Active');
    // The dropdown of a plain <select> never makes it into the video, so take a screenshot of the
    // state after choosing to make up for it
    await shot('filter-filled');

    mark('検索を実行');
    await click(page.getByRole('button', { name: 'Search' }).first(), { pause: 'observe' });
    await shot('result');

    mark('ファイルを添付');
    // select() and upload() show a caption on their own: their dropdown and file picker are drawn
    // by the operating system, so they stay out of the frame and the caption says it instead.
    await upload(page.locator('#import_file'), path.join(__dirname, 'sample.csv'));
    await shot('file-selected');

    // note() is for what only the author of the step script knows has to be said out loud. It is
    // turned off by the same CAPTIONS=off switch, and is not for narrating what the frame shows.
    await note('この行はシードデータで、この操作で作られたものではありません。', {
      target: page.locator('#user_row_1'),
    });

    mark('コードをコピーして検索欄に貼り付け');
    // The keyboard leaves no trace on screen, so hotkey() shows a key hint overlay next to the
    // element being operated on. `label` is written in the language the MR reviewer reads.
    // `ControlOrMeta` keeps the step script runnable on macOS as well as Windows/Linux.
    await hotkey('ControlOrMeta+A', { label: '全選択', target: page.locator('#q_name_cont') });
    await hotkey('ControlOrMeta+C', { label: 'コピー' });

    mark('詳細モーダルを開いて閉じる');
    // The modal animation runs longer than 'observe' allows, so pin the wait down in ms
    await click(page.getByRole('button', { name: 'Detail' }).first(), { pause: 4200 });
    await shot('detail-modal');
    // Hold the modal long enough, and close it with the real button in the UI: the viewer needs to
    // see which button was pressed. Use hotkey() only when the shortcut itself is what the MR has
    // to prove, or when the UI has no button for it.
    await click(page.getByRole('button', { name: 'Close' }).first(), { pause: 2000 });
  },
};
