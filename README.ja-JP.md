<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./docs/images/logo/logo-lockup-dark.svg">
    <img src="./docs/images/logo/logo-lockup.svg" alt="webapp-evidence" width="420">
  </picture>
</p>

<p align="center">
  <strong>操作を伝えれば、録画が返ってくる。</strong><br>
  <sub>コマンド 1 つで Web アプリを録画し、動画・スクリーンショット・ランブックを返します。UAT、引き継ぎ、バグ報告、レビューに。</sub><br>
  <code>/webapp-evidence:recording</code>
</p>

<p align="center">
  <a href="./LICENSE"><img alt="License: MIT" src="https://img.shields.io/github/license/TOMOSIA-VIETNAM/webapp-evidence?style=flat-square&color=blue"></a>
  <a href="#インストール"><img alt="Claude Code" src="https://img.shields.io/badge/Claude_Code-supported-D97757?style=flat-square&logo=anthropic&logoColor=white"></a>
  <a href="#インストール"><img alt="Cursor" src="https://img.shields.io/badge/Cursor-supported-000000?style=flat-square&logo=cursor&logoColor=white"></a>
  <a href="#インストール"><img alt="Codex" src="https://img.shields.io/badge/Codex-supported-412991?style=flat-square&logo=openai&logoColor=white"></a>
  <a href="#インストール"><img alt="Gemini CLI" src="https://img.shields.io/badge/Gemini_CLI-supported-4285F4?style=flat-square&logo=google&logoColor=white"></a>
  <a href="#インストール"><img alt="Antigravity" src="https://img.shields.io/badge/Antigravity-supported-6E56CF?style=flat-square"></a>
</p>

<p align="center">
  <a href="./README.md">English</a> · <a href="./README.vi-VN.md">Tiếng Việt</a> · <strong>日本語</strong> · <a href="./README.zh-Hans.md">简体中文</a>
</p>

機能が動くことを示すには画面録画に 30 分ほどかかり、それでも動画は思うように仕上がりません。スク
リーンショットは一拍遅れ、ポインターは飛び、ドロップダウンは開いたところが映らない。代わりに、操作
をコーディングエージェントに伝えてください。Chrome を操作し、動画と主要ステップのスクリーンショッ
ト、そして同じテイクを再現できるランブックを返します。

## インストール

**Claude Code**

```bash
claude plugin marketplace add TOMOSIA-VIETNAM/webapp-evidence
claude plugin install webapp-evidence@webapp-evidence
```

**Cursor, Codex, Gemini CLI, Antigravity**

```bash
curl -fsSL https://raw.githubusercontent.com/TOMOSIA-VIETNAM/webapp-evidence/main/install.sh | bash
```

使っているプラットフォームを聞き、どこに配置したかを教えます。録画には Chrome、ffmpeg、Node が必
要で、足りないものはエージェントが名前を挙げてインストールを申し出ます。

## 最初の録画

ページと手順を、自分の言葉で渡します:

```
/webapp-evidence:recording Page: https://app.example.com/search
Flow:
1. Search for "abc" with status Active
2. Open the first row, then close the detail panel
3. Export the result to CSV
```

返ってくるのは `<name>.mp4`、連番のスクリーンショット、そして `<name>-runbook.md` — タイムライン、
字幕、記録されたページエラー、そしてそのテイクを生んだコマンドです。チケットや MR、報告書にそのま
ま添付してください。Git にコミットされるものはなく、どこかへ送られるものもありません。

覚えるべき構文はありません。*「さっき直した画面のエビデンスを取って」* で通りますし、書いた言語で
そのまま返事が来ます。入力する場所:

| プラットフォーム | コマンド |
|---|---|
| Claude Code | `/webapp-evidence:recording` |
| Cursor, Gemini CLI, Antigravity | `/webapp-evidence-recording` |
| Codex | `$webapp-evidence-recording` |

## 1 つのテイクに、3 種類の証拠

画面の録画だけではフルスタックの変更の半分しか示せません。同じテイクの中で、ブラウザーが持っている
セッションのまま API を呼び、データベースを読み返せます — 動画も 1 本、ランブックも 1 つ:

```
/webapp-evidence:recording Page: https://app.example.com/orders
Flow:
1. Create an order for SKU ABC, quantity 2
2. Call POST /api/orders and show it answering 201
3. Query the orders table and show the row that appeared
```

- **画面。** フォームは見えるポインターが入力して送信します。視聴者が読める速さで。
- **エンドポイント。** ページの上にターミナルパネルが開き、ブラウザー自身の Cookie で curl が走りま
  す — `HTTP 201 in 0.184s` が映像に残ります。ステップがステータスを表明するので、違う値ならテイク
  が失敗し、証拠として出回ることはありません。
- **データベース。** `psql`、`mysql`、rake タスク — 普段自分で叩くものを、同じパネルで。新しい行が、
  それを作った画面と同じフレームに並びます。

Cookie とトークンはファイル経由で curl に渡り、動画・スクリーンショット・ランブックのすべてでマス
クされます。

## テイクの中身

<p align="center">
  <img src="./docs/demo/site-tour.gif" width="820" alt="ランディングページのツアー録画。ヒーローの蛾がポインターに反応し、ワンライナーのインストールコマンドをコピーしてボタンがそれを確認、そのまま How it works、レビューラウンドのウォークスルーを 1 ステップずつ、機能カードへとページを読み下ろします。">
</p>

この gif はより長いテイクの一部です。並んで置かれるランブックが動画の内容を説明するので、受け取った
人は見る代わりに読むこともできます:

```markdown
## Steps in the video

00:21 - 00:26  Hero — copy the one-line install command
00:36 - 00:49  Review rounds — every step of the loop, picked by hand
01:13 - 01:26  The SEO meta the page serves, read straight off the URL

## Commands run in the terminal

- 01:24  `curl -s https://open-pr.vercel.app/ | grep -oE '<title>[^<]*</title>|…'` — exit 0

## Page errors recorded during the take

- none
```

録画中はコンソールとネットワークも見ています。誰も見ていなかった呼び出しの 401 は、ステータスと
URL つきで最後のブロックに残ります。機能を作ったセッションでそのまま録画すれば、エージェントはその
スクリーンショットとエラーを e2e の 1 回分として読み返し、ファイルを渡すだけでなく直し方まで提案し
ます。

## 頼み方

| やりたいこと | こう打つ |
|---|---|
| 直したばかりの画面のエビデンス | `/webapp-evidence:recording` — 何を触っていたかは分かっています |
| MR / PR 用のエビデンス | `/webapp-evidence:recording https://gitlab.example.com/group/admin/-/merge_requests/1783` |
| データが変わった後、同じテイクをもう一度 | `/webapp-evidence:recording record that again` — 古いテイクは `v1`、`v2`… として残ります |
| ゆっくり録る、字幕を別の言語に | `/webapp-evidence:recording record it slower`、`captions in Japanese` — プロジェクトごとに覚えます |
| 秘密の値を録画から外す | `/webapp-evidence:recording blur the API key when it appears` |
| ドロップダウンやダイアログ自体を映す | `/webapp-evidence:recording --screen` — ブラウザーウィンドウを録るので、OS が描くものも入ります |
| 内容にかかわらず画面を使わない | `/webapp-evidence:recording --headless` — 既定であり、その判断を先に決めておく方法 |
| README 用の gif、自分の管理下のページ用の webm | `/webapp-evidence:recording -f gif`、`-f webm` — それ以外は mp4。どこでもそのまま再生されます |
| 動画を見ずに中身を知る | `/webapp-evidence:vision <the mp4>` |
| ログイン済みの状態から始まる録画 | `/webapp-evidence:recording set up the evidence config for this project` |
| おかしい点・足りない点を伝える | `/webapp-evidence:feedback` |

`vision` があるのは、エージェントが動画を見られないからです。数秒ごとに 1 フレームを切り出し、
`mm:ss` を焼き込んだシートに並べます。だから指摘は「00:14 でヘッダーが表に重なっている」という形で
返り、その時刻はランブックと突き合わせて自分で確かめられます。上のテイクから作られたシート:
**[1](./docs/demo/vision-sheet-01.png)** ·
**[2](./docs/demo/vision-sheet-02.png)** ·
**[3](./docs/demo/vision-sheet-03.png)**。

## 制限

録るのはページであって、画面ではありません。OS が描くものは映りません: `<select>` のドロップダウ
ン、ファイル選択ダイアログ、`confirm`/`alert`。それぞれには何を選んだかの字幕と直後の状態のスクリー
ンショットが付きます。モーダル、日付ピッカー、JS 製のドロップダウンは普通に録れます。そのダイアログ
自体が証拠になる場合は `--screen` がブラウザーウィンドウを録画します — 画面と許可、そして録画の間
マシンを触らないことが必要なので、エージェントが先に確認します。

ターミナルパネルが扱えるのは行単位の出力です: `vim`、`less`、`htop` は対象外。録画は指定したサイト
だけを対象にします。

バージョンを固定する、ブランチを追いかける:

```bash
curl -fsSL https://raw.githubusercontent.com/TOMOSIA-VIETNAM/webapp-evidence/main/install.sh | bash -s -- --ref main
```

`--ref v1.1.3` はリリースを固定し、`--ref latest` はリリース追従に戻します。以降の実行は最後に指定
したものを保ちます。更新は `~/.webapp-evidence/scripts/install-local.sh --update`、削除は
`--uninstall --all`。

---

上の録画はこのリポジトリのランナーによる実出力です: `docs/demo/record.sh` が
`docs/demo/site-tour-steps.js` から生成します。スキル自体に手を入れるなら
**[CONTRIBUTING.md](./CONTRIBUTING.md)** を参照してください。
