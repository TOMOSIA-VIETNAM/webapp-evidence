import type { Dictionary } from './en'

export const ja: Dictionary = {
  'meta.title': 'webapp-evidence — フローを書けば、録画が届く',
  'meta.description':
    'AI コーディングエージェント向けのオープンソース skill。Web アプリを録画し、動画・スクリーンショット・ランブックを返します。UAT、引き継ぎ、バグ報告、レビューのエビデンスに。',

  'nav.label': 'メイン',
  'nav.uat': 'UAT',
  'nav.howItWorks': '使い方',
  'nav.features': '機能',
  'nav.install': 'インストール',
  'nav.github': 'GitHub',
  'nav.skipToContent': '本文へスキップ',
  'nav.languageMenu': '言語を選択',
  'lang.en': 'English',
  'lang.vi': 'Tiếng Việt',
  'lang.ja': '日本語',
  'lang.zh': '简体中文',
  'lang.en.short': 'EN',
  'lang.vi.short': 'VI',
  'lang.ja.short': 'JA',
  'lang.zh.short': 'ZH',

  'action.copy': 'コピー',
  'action.copied': 'コピー済み',
  'action.scrollTop': 'ページの先頭へ',

  'hero.badge': 'オープンソース · MIT',
  'hero.headline': 'フローを書けば、録画が届く。',
  'hero.lead':
    'コマンドひとつで Web アプリを録画し、動画、主要ステップのスクリーンショット、ランブックを返します。UAT、引き継ぎ、バグ報告、レビューが求めるエビデンスを、30 分の画面収録なしで。',
  'hero.cta.start': 'インストール',
  'hero.cta.github': 'GitHub で見る',
  'hero.command.label': 'あとはエージェントでこれを入力',
  'hero.platforms': '対応環境',
  'hero.mark.alt': 'webapp-evidence のホタル。お尻の光が録画ランプのように灯っている',
  'hero.output.video': '操作動画',
  'hero.output.shots': '主要ステップのスクリーンショット',
  'hero.output.runbook': 'ランブック',

  'uat.eyebrow': 'UAT のために',
  'uat.heading': '受け入れ基準を入れれば、承認できるエビデンスが出てくる',
  'uat.lead':
    'AI で変更は速くなりました。でも動作の証明は速くなっていません。受け入れテストは今も、誰かが基準をひとつずつクリックし、手で録画しています。基準をフローとして書いてください。1 回のテイクで、どの基準も動画に映り、タイムスタンプが付き、ページのエラーはすべて記録されて返ってきます。',
  'uat.step1.title': '基準をフローとして書く',
  'uat.step1.body':
    '番号付きのステップを普段の言葉で、チームの言語のまま。MR や PR のリンクでも構いません。エージェントが差分を読み、フローを導き出します。',
  'uat.step2.title': '1 回のテイクで全ステップを実行',
  'uat.step2.body':
    'Chrome を見えるポインターで、視聴者が追える速さで操作します。エンドポイントを呼ぶステップはステータスを検証するので、誤った応答はエビデンスとして出荷されず、テイクが止まります。',
  'uat.step3.title': 'ランブックがそのまま報告書',
  'uat.step3.body':
    '各ステップの動画内の時刻、実行したコマンドと終了コード、録画中に出たコンソールエラーや失敗したリクエストのすべて。',
  'uat.step4.title': '承認するか、差し戻すか',
  'uat.step4.body':
    'レビュアーはフローを再実行せず、各基準をタイムスタンプと照合します。修正後は「もう一度録画して」で新しいテイクを作り、古いテイクも横に残ります。',

  'uat.report.title': '実際のテイクを UAT 報告書として読む',
  'uat.report.lead':
    'README のデモは open-pr のランディングページを録画したものです。基準を選ぶと、それを証明するランブックの行が示されます。',
  'uat.report.criteria': '受け入れ基準',
  'uat.report.runbook': 'ランブック',
  'uat.report.ac1': 'ヒーローからインストールコマンドをコピーできる',
  'uat.report.ac2': 'レビューループの各ステップを手で選べる',
  'uat.report.ac3': 'ページが SEO の title と description を返す',
  'uat.report.ac4': 'テイク中にコンソールエラーや失敗したリクエストがない',
  'uat.report.source': 'docs/demo/record.sh が生成したランブックから無編集で引用しています。',
  'uat.report.reset': 'すべての行を表示',

  'how.eyebrow': '使い方',
  'how.heading': '3 ステップ、いつものエージェントの中で',
  'how.step1.title': 'skill をインストール',
  'how.step1.body':
    'Claude Code、Cursor、Codex、Gemini CLI、Antigravity のどれでもコマンドひとつ。録画には Chrome、ffmpeg、Node が必要です。足りないものはエージェントが伝え、インストールを提案します。',
  'how.step2.title': 'フローを書く',
  'how.step2.body':
    'ページと手順を書くか、何も書かなくても構いません。変更の直後なら、どの画面を触っていたかエージェントはもう知っています。',
  'how.step3.title': 'エビデンスを受け取る',
  'how.step3.body':
    'mp4、番号付きスクリーンショット、ランブックがあなたのディスクに。チケット、MR、報告書への添付はあなたの手で。何もコミットされません。',
  'how.demo.caption': 'このリポジトリのランナーによる実際の出力。open-pr.vercel.app を巡回しています。',
  'how.demo.alt':
    'ランディングページのツアー: インストールコマンドがコピーされボタンが確認を表示し、「使い方」を読み進め、レビューラウンドの説明を 1 ステップずつクリックし、機能カードへ。',

  'proof.eyebrow': 'フルスタックのエビデンス',
  'proof.heading': '1 回のテイクで画面、エンドポイント、データベースを証明',
  'proof.lead':
    '画面録画が示すのはフルスタックの変更の半分だけです。同じテイクで、ブラウザが保持しているセッションのまま API を呼び、書き込まれた行をデータベースから読み返せます。',
  'proof.request.label': '入力するもの',
  'proof.screen.title': '画面',
  'proof.screen.body': 'フォームは見えるポインターで入力・送信されます。視聴者が読める速さで。',
  'proof.endpoint.title': 'エンドポイント',
  'proof.endpoint.body':
    'ページの上にターミナルパネルが開き、ブラウザの Cookie で curl が走ります。ステップがステータスを検証する様子も動画に残ります。',
  'proof.database.title': 'データベース',
  'proof.database.body':
    'psql、mysql、rake タスクなど、自分で実行するものなら何でも。新しい行が、それを作った画面の横に映ります。',
  'proof.secrets':
    'Cookie とトークンはファイル経由で curl に渡り、動画、スクリーンショット、ランブックのすべてでマスクされます。',

  'vision.eyebrow': 'テイクの確認',
  'vision.heading': 'エージェントは動画を観られない。vision なら読める。',
  'vision.lead':
    '録画を数秒ごとのフレームに分け、各フレームに mm:ss を刻んだコンタクトシートに並べます。指摘は「00:14 でヘッダーが表に重なる」のように返り、ランブックと照合できます。',
  'vision.sheet': 'コンタクトシート',
  'vision.sheet.alt': 'README デモのコンタクトシート: テイクからのタイムスタンプ付きフレームのグリッド',

  'features.eyebrow': '機能',
  'features.heading': 'レビュアーが信頼できるエビデンス',
  'features.human.title': '人が操作したように見える',
  'features.human.body':
    'ポインターは移動し、タイピングには揺らぎがあり、スクロールは目的の場所で止まります。何も飛びません。',
  'features.runbook.title': 'ただのファイルではなくランブック',
  'features.runbook.body':
    'タイムライン、字幕、実行したコマンド、発生したページエラー、そして同じテイクをもう一度作るコマンド。',
  'features.secrets.title': '秘密は映さない',
  'features.secrets.body': 'ぼかす、黒塗りにする、区間ごと切る。動画でもスクリーンショットでも。',
  'features.local.title': 'マシンの外に何も出ない',
  'features.local.body':
    'サービスもボットアカウントもありません。手元のエージェント CLI の中で、指定したサイトだけを相手に動きます。',
  'features.native.title': 'ダイアログそのものが証拠なら',
  'features.native.body':
    'ネイティブのドロップダウンや confirm ダイアログは既定で字幕に記録されます。それ自体がエビデンスなら、--screen でブラウザのウィンドウごと録画します。',
  'features.language.title': '覚える構文はない',
  'features.language.body':
    'どの言語で頼んでも、エージェントはその言語で答えます。別の言語の字幕、ゆっくりしたテイク — プロジェクトごとに記憶されます。',

  'install.eyebrow': 'インストール',
  'install.heading': '使っているエージェントを選ぶ',
  'install.lead': 'ひとつの skill、5 つのプラットフォーム。実行コマンドは入力する場所によって変わります。',
  'install.column.install': 'インストール',
  'install.column.use': '録画',
  'install.column.vision': '動画を読み返す',
  'install.requirements':
    '録画には Chrome、ffmpeg、Node が必要です。ワンライナーは使うプラットフォームを尋ね、どこに入ったかを伝えます。',

  'footer.releases': 'リリース',
  'footer.issues': 'Issues',
  'footer.license': 'ライセンス',
  'footer.by': '開発',
  'footer.licenseLine': 'MIT ライセンスのオープンソース',
}
