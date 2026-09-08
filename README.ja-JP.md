<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./docs/images/logo/logo-lockup-dark.svg">
    <img src="./docs/images/logo/logo-lockup.svg" alt="webapp-evidence" width="420">
  </picture>
</p>

<p align="center">
  <strong>操作手順を書くだけで、録画ができます。</strong><br>
  <sub>コマンド 1 つで Web アプリを録画し、動画・スクリーンショット・runbook を返します。UAT、引き継ぎ、バグ報告、レビューに。</sub><br>
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

アプリが実際に動くところを、誰かに見せる場面はいずれ来ます。UAT の承認、別チームや協力会社への
引き継ぎ、バグ報告、デモ、コードレビュー。ところが自分で録ると、30 分かけても出来がよくありま
せん。スクリーンショットは一瞬遅れて撮れてしまう。マウスは画面を飛び回る。ドロップダウンは映ら
ないので、何を選んだのか誰にも分かりません。

そこで、手順はコーディングエージェントに伝えてしまいます。エージェントが Chrome を操作して、
きれいな動画と、要所を押さえたスクリーンショット、そしてその録画を再現する runbook を返します。

## こう頼みます

```
/webapp-evidence:recording Page: https://www.saucedemo.com
Flow:
1. Log in using standard_user / secret_sauce
2. Change the sort dropdown to "Price (low to high)"
3. Add "Sauce Labs Backpack" to the cart, then open the cart
4. Checkout, fill First Name / Last Name / Zip as Minh / Tang / 700000
5. Continue, then Finish, and stop at the "Thank you for your order!" screen
```

## こう返ってきます

<p align="center">
  <img src="./docs/demo/saucedemo.gif" width="820" alt="Swag Labs のチェックアウトの録画。カーソルがサインインし、商品一覧を価格順に並べ替え（ドロップダウンはオペレーティングシステムが描画していて録画に映らないため、選んだ項目が画面下部の字幕で示されます）、バックパックをカートに入れ、チェックアウトのフォームを埋め、注文を完了します。">
</p>

要所を押さえたスクリーンショットが 8 枚。そして runbook — 受け取った人は、動画を見ずに読むだけ
で済みます:

```markdown
## Steps in the video

00:00 - 00:01  Open the sign-in screen
00:01 - 00:08  Sign in as standard_user
00:08 - 00:13  Sort the product list by Price (low to high)
00:13 - 00:16  Add Sauce Labs Backpack to the cart
00:16 - 00:19  Open the shopping cart
00:19 - 00:26  Enter the customer information
00:26 - 00:29  Review the order summary
00:29 - 00:36  Finish the order

## Captions shown in the video

- 00:10  Selected "Price (low to high)". The dropdown menu is drawn by the operating
         system, so it does not appear in this recording.
- 00:31  The order is placed on the public saucedemo.com demo site, so no real data
         is created.

## Page errors recorded during the take

- [http 401] https://events.backtrace.io/api/unique-events/submit…
```

最後のセクションはおまけです。録画しながらコンソールとネットワークも見ているので、ここでは
読む人がページの 401 エラーに気づけます。スクリーンショットには写らず、誰も探していなかった
情報です。

runbook には、その録画を作ったコマンドもそのまま入っています。データが変わった、動画が壊れた、
相手がもっとゆっくり見たいと言った — もう一度頼むだけです。過去の録画は `v1`、`v2`、… として
残り、上書きされません。一度送った録画は、唯一作り直せないものだからです。

## 動画が「見られる」理由

- **カーソルが見えて、人の手のように動きます。** 曲線を描き、素早く動き出し、ゆっくり止まり、
  遠い的では少し行き過ぎてから戻ります。クリックごとに波紋が残ります。
- **テンポが画面に合わせて変わります。** 画面遷移だけのクリックは速く進み、結果が出たところでは
  読める長さだけ止まります。
- **カメラに写らないものは字幕で伝えます。** `<select>` メニューやファイル選択ダイアログは
  オペレーティングシステムが描画していて、ページの録画には入りません。そのため画面下部の字幕が
  何を選んだかを示します。キーボードショートカットは、対象の要素の横にキーヒント（`⌘ + C`）が
  出ます。
- **ページ読み込みの待ち時間はカットされ**、作業が始まるところから動画が始まります。

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

どのプラットフォームを使うか尋ねたうえで、どこに何を置いたかを教えてくれます。録画には Chrome、
ffmpeg、Node が必要です。足りないものがあれば、エージェントが名前を挙げてインストールを
提案します。

このワンライナーは最新のリリースを入れます。リリースがまだない間は `main` です。別のものを選ぶ
ときは `--ref` を使います。指定は記憶されるので、次に更新しても選んだ場所のままです:

```bash
curl -fsSL … /install.sh | bash -s -- --ref main       # a branch, to try a change before it ships
curl -fsSL … /install.sh | bash -s -- --ref v1.2.0     # a release, to pin a team to one version
curl -fsSL … /install.sh | bash -s -- --ref latest     # back to following releases
```

更新は `~/.webapp-evidence/scripts/install-local.sh --update`、削除は `--uninstall --all` です。
1 点だけ注意: `install.sh` は常にデフォルトブランチから取得されるので、インストーラ自体の修正は
そこにマージされてから届きます。

## 頼み方は 3 通り

| platform | how you call it |
|---|---|
| Claude Code | `/webapp-evidence:recording` |
| Cursor, Gemini CLI, Antigravity | `/webapp-evidence-recording` |
| Codex | `$webapp-evidence-recording` |

**タスクやバグ修正を終えた直後。** どの画面が変わったかはエージェントが把握しているので、後ろに
何も書く必要はありません:

```
/webapp-evidence:recording
```

**リンクしか手元にない。** MR/PR の説明と diff を読んで、何を録るべきかを判断します:

```
/webapp-evidence:recording https://gitlab.example.com/group/admin/-/merge_requests/1783
```

**コードは書かない。** 上の例のように、ページと見せたい内容を伝えるだけです。リポジトリも設定も
準備もいりません。手順は自分が考えている言語で書いてかまいません。エージェントは同じ言語で
答えます。

覚える構文もありません — 「さっき直した画面の証跡を取って」でも同じ結果になります。

## プロジェクトに一度だけ向ける

```
/webapp-evidence:recording set up the evidence config for this project
```

ログイン画面と開発用アカウントを見つけて、`evidence.config.js` を書き出します。それ以降は、
どの録画も動く環境にサインインした状態から始まり、もう尋ねられません。

変えたいことは言うだけです — 「もっとゆっくり録って」「字幕は日本語で」「最新の録画だけ残して」
— そのファイルを書き換えてくれます。

## 知っておきたい制限

録画対象はページで、画面全体ではありません。そのためオペレーティングシステムが描画するものは
フレームに入りません: `<select>` のドロップダウン、ファイル選択ダイアログ、`confirm`/`alert`
ダイアログ。これらの場面には、何を選んだかを示す字幕と、直後の状態のスクリーンショットが付き
ます。JS で作られたモーダル、日付ピッカー、ドロップダウンはふつうに録画されます。

録画はローカルの開発環境か、指定したサイトだけを対象にします。ステージングや本番は対象外です。

動画とスクリーンショットは Git に入りません。チケット、MR/PR、報告書 — どこに添付するかは自分で
決めて行います。

---

上の録画は、このリポジトリのランナーによる実際の出力です: `docs/demo/record.sh` が
`docs/demo/saucedemo-steps.js` から生成しています。スキル自体に手を入れたい場合は
**[CONTRIBUTING.md](./CONTRIBUTING.md)** を参照してください。
