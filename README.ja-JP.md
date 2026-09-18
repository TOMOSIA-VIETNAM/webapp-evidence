<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./docs/images/logo/logo-lockup-dark.svg">
    <img src="./docs/images/logo/logo-lockup.svg" alt="webapp-evidence" width="420">
  </picture>
</p>

<p align="center">
  <strong>手順を伝えると、録画が返ってきます。</strong><br>
  <sub>コマンド 1 つで Web アプリを録画し、動画・スクリーンショット・runbook を返します。UAT、引き継ぎ、バグ報告、レビュー向け。</sub><br>
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

アプリがちゃんと動くところを見せる場面は必ず来ます。UAT、別チームへの引き継ぎ、バグ
報告、デモ、レビュー。自分で録ると 30 分くらいかかっても、スクリーンショットは遅れ、マウスは
飛び、ドロップダウンは映像に出ないので何を選んだのか分かりません。

手順をコーディングエージェントに伝えてください。Chrome を操作して、動画、主要なステップの
スクリーンショット、同じ録画を再現できる runbook を返します。

## 例

```
/webapp-evidence:recording Page: https://open-pr.vercel.app
Flow:
1. Open the language menu, go through every language, then come back to English
2. Hover the moth in the hero, then copy the one-line install command
3. Read down the page: How it works, the review-round walkthrough and every step of
   the loop, the feature cards, the token-cost chart
4. On Install, switch to the Codex and Cursor tabs, then copy the command of the open one
5. Take the floating button back to the top, print the SEO meta the page serves in a
   terminal, and close the tour in Japanese
```

## 出力

<p align="center">
  <img src="./docs/demo/site-tour.gif" width="820" alt="ランディングページのツアー録画。ヒーローの蛾がポインターに反応し、ワンライナーのインストールコマンドをコピーしてボタンがそれを確認、そのまま How it works、レビューラウンドのウォークスルーを 1 ステップずつ、機能カードへとページを読み下ろします。">
</p>

GIF は長いテイクの一部です。全体を GIF にすると数倍の大きさになり、README に置くものではありません。主要ステップのスクリーンショット 25 枚と、見る代わりに読める runbook が付きます:

```markdown
## Steps in the video

00:00 - 00:01  Hero — the page as it opens
00:01 - 00:15  Language menu — every language the site ships
00:15 - 00:19  Back to English — the language the rest of the tour runs in
00:19 - 00:22  Hero — the moth answers the pointer
00:22 - 00:27  Hero — copy the one-line install command
00:27 - 00:32  How it works — the three steps light up under the pointer
00:32 - 00:37  Review rounds — the walkthrough plays itself
00:37 - 00:49  Review rounds — every step of the loop, picked by hand
00:49 - 00:54  Features — the cards warm as the pointer crosses them
00:54 - 00:57  Token cost — the chart the plugin publishes
00:57 - 01:04  Install — one panel per agent
01:04 - 01:06  Install — copy the command of the open panel
01:06 - 01:10  Footer — the links at the end of the page
01:10 - 01:14  The floating button flies the reader back to the top
01:14 - 01:27  The SEO meta the page serves, read straight off the URL
01:27 - 01:33  Closing on 日本語

## Captions shown in the video

- 00:23  The command is on the clipboard. The button was read back for its "Copied"
         state, because a blocked clipboard leaves a click that proves nothing.
- 01:14  The terminal panel runs against the live URL, so these tags come from what
         the site is serving right now.

## Commands run in the terminal

- 01:24  `curl -s https://open-pr.vercel.app/ | grep -oE '<title>[^<]*</title>|…'` — exit 0

## Page errors recorded during the take

- none
```

録画中はコンソールとネットワークも監視します。このテイクはエラーなしで終わりました。それ自体、
読み手が確かめられる主張です。エラーが出たときは最後のブロックにステータスと URL ごと並びます。
誰も見ていなかったリクエストの 401 は、スクリーンショットには写りません。

実装中のセッションで録った場合は、スクリーンショットとエラーログを E2E と同じ目線で見ます。
401 や、はみ出したり崩れたレイアウト。気づいたものは指摘して、修正案も出せます。ファイルを渡す
だけではありません。

runbook には、その録画を作ったコマンドも残っています。データが変わった、動画が壊れた、もっと
ゆっくり見たい、というときはもう一度頼めばいいです。過去の録画は `v1`、`v2`、… として残り、
上書きされません。一度送った録画は、同じファイルとしては作り直せないからです。

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

どのプラットフォームを使うか聞いたうえで、どこに入れたかを教えてくれます。録画には Chrome、
ffmpeg、Node が必要です。足りないものがあれば、エージェントが名前を挙げてインストールを提案
します。

ブランチを追う、またはバージョンを固定する場合:

```bash
curl -fsSL https://raw.githubusercontent.com/TOMOSIA-VIETNAM/webapp-evidence/main/install.sh | bash -s -- --ref main
```

`--ref v1.2.0` はバージョンの固定、`--ref latest` はリリース追従に戻ります。以降の実行は、最後に
指定されたものをそのまま追い続けます。更新は
`~/.webapp-evidence/scripts/install-local.sh --update`、削除は `--uninstall --all` です。

## 使い方

呼び出し方は使っているプラットフォームによって変わります:

| platform | command |
|---|---|
| Claude Code | `/webapp-evidence:recording` |
| Cursor, Gemini CLI, Antigravity | `/webapp-evidence-recording` |
| Codex | `$webapp-evidence-recording` |

頼めることは次のとおりです:

| やりたいこと | 入力するもの |
|---|---|
| いま直した画面の証跡 | `/webapp-evidence:recording` — 直前の作業から判断します |
| MR / PR の証跡 | `/webapp-evidence:recording https://gitlab.example.com/group/admin/-/merge_requests/1783` |
| 説明したとおりにページを録る | `/webapp-evidence:recording Page: https://app.example.com/search` に続けて手順を、上の例のように |
| 同じ内容をもう一度 | `/webapp-evidence:recording もう一度録って` — コマンドはランブックにあり、前の録画も残ります |
| もっとゆっくり録る | `/webapp-evidence:recording もう少しゆっくり録って` |
| 字幕を別の言語で | `/webapp-evidence:recording 字幕は英語で` — プロジェクトごとに覚えます |
| クリックがバックエンドまで届いた証拠 — ジョブが動いた、ファイルが書かれた | `/webapp-evidence:recording Run sync を押したあとワーカーのログを見せて` |
| 字幕ではなく、ドロップダウンやダイアログそのものを動画に入れたい | `/webapp-evidence:recording --screen` — 1 分ほどマシンを預けます。フラグなしなら先に確認されます |
| 見せてはいけない値を録画から外す | `/webapp-evidence:recording API キーが出るところはぼかして` |
| 最初に一度だけ設定して、以降はログイン済みで録る | `/webapp-evidence:recording set up the evidence config for this project` |

手順は自分が使っている言語で書いてかまいません。エージェントも同じ言語で答えます。覚える構文も
ないので、「さっき直した画面の証跡を取って」で通じます。

## 録画ができたら

| やりたいこと | コマンド |
|---|---|
| README など画像しか表示できない場所に貼る gif がほしい | `/webapp-evidence:recording -f gif` |
| 自分で管理しているページに置く webm がほしい | `/webapp-evidence:recording -f webm` |
| 動画を見ずに、何が映っているか知りたい | `/webapp-evidence:vision <mp4 ファイル>` |
| 不具合を伝える、足りないものを頼む | `/webapp-evidence:feedback` |

既定が mp4 なのは、マージリクエストでも issue でもチャットでもそのまま再生でき、3 つの形式で
いちばん軽いからです。同じ録画の gif は数倍のサイズになるので、変換は提案するだけで勝手には
行いません。

`vision` があるのは、エージェントが動画を再生できないからです。数秒に 1 フレーム、`mm:ss` 付きの
シートに並べて画像として読みます。だから指摘は「00:14 でヘッダーが表とかぶっている」という形に
なります——自分で確認でき、runbook とも突き合わせられる時刻です。遷移の途中で崩れるレイアウト、
一瞬だけ出て消えるバナー。誰もスクリーンショットを撮ろうと思わなかったものを拾ってくれます。

上の録画から実際に作られたシートです:
**[シート 1](./docs/demo/vision-sheet-01.png)**（00:00–00:38）·
**[シート 2](./docs/demo/vision-sheet-02.png)**（00:40–01:18）·
**[シート 3](./docs/demo/vision-sheet-03.png)**（01:20–01:32）。

## 制限

録画対象はページで、画面全体ではありません。OS が描画するものは映像に入りません:
`<select>` のドロップダウン、ファイル選択ダイアログ、`confirm`/`alert` ダイアログ。これらの
場面には、何を選んだかを示す字幕と、直後の状態のスクリーンショットが付きます。JS で作られた
モーダル、日付ピッカー、ドロップダウンは普通に録画されます。

そのダイアログ自体を見せたいときは、ページではなくブラウザのウィンドウを録画できます。その
場合はダイアログも映像に入ります。ただし画面と権限が要り、録画のあいだマシンに触れられない
ので、既定にはしていません。実行する前にエージェントが確認しますし、質問の場所を知らせる
通知が画面に出ます。最初から指定するなら `/webapp-evidence:recording --screen` です。

画面に出てしまう値は、ぼかす・塗りつぶす・その区間ごと削る、のいずれかで録画から外せます。
手順を伝えるときに言ってください。スクリーンショットからも同じように外れます。

証拠がページ上にまったく現れない場合 — ジョブが動いた、ファイルが書かれた — 手順の中で
ページの上にターミナルパネルを開き、実際のコマンドと実際の出力を同じ動画に収められます。
行単位の出力だけが対象で、`vim`、`less`、`htop` は使えません。

録画は指定したサイトだけを対象にします。

動画とスクリーンショットは Git に入りません。チケット、MR/PR、報告書のどこに添付するかは自分で
決めてください。

---

上の録画は、このリポジトリのランナーによる実際の出力です。`docs/demo/record.sh` が
`docs/demo/site-tour-steps.js` から生成しています。スキル自体に手を入れたい場合は
**[CONTRIBUTING.md](./CONTRIBUTING.md)** を参照してください。
