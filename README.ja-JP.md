<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./docs/images/logo/logo-lockup-dark.svg">
    <img src="./docs/images/logo/logo-lockup.svg" alt="webapp-evidence" width="420">
  </picture>
</p>

<p align="center">
  <strong>証跡は、自分で記録される。</strong><br>
  <sub>一度頼むだけ。動画とスクリーンショット、そしてレビュアーにそのまま渡せる runbook が手に入ります。</sub><br>
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

merge request に証跡を添える作業は、たいてい残念な結果に終わります。タイミングを外したスクリーン
ショット。あるいは、マウスが瞬間移動し、ドロップダウンは開かれず、どのボタンを押したのか誰にも
分からない画面録画。だから多くの変更は証跡なしで出ていき、レビューは信頼だけを頼りに進みます。

## こう頼むと

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

さらに、要所を押さえた 8 枚のスクリーンショットと、動画を見なくても読むだけで分かる runbook が
付いてきます:

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

最後のセクションは、誰も予想していなかった部分です。録画中もランナーはコンソールとネットワーク
を監視しているので、ページが 401 を返していたことがレビュアーに伝わります。どんなスクリーン
ショットにも写らず、誰も探していなかった事実です。

runbook には、その録画をそのまま再現するコマンドも含まれています。データが変わった、動画が壊れた、
レビュアーがもっとゆっくり見たいと言っている — もう一度頼むだけです。前回の録画は上書きされず
`v1`、`v2`… として残ります。MR に添えて送ってしまった証跡だけは、あとから作り直せないからです。

## レビュアーの時間に見合う理由

- **カーソルが見えていて、人の手のように動きます** — 曲線を描き、素早く加速し、ゆっくり減速し、
  遠くの目標にはいったん行き過ぎてから戻ります。クリックのたびに波紋が残ります。
- **テンポは画面に合わせます。** 画面遷移だけのクリックはテンポよく、結果が現れた瞬間は読める
  だけの時間しっかり止まります。
- **フレームに収まらないものは、言葉にします。** `<select>` メニューやファイル選択ダイアログは
  オペレーティングシステムが描画するため、ページの録画には決して入りません。そこで画面下部の
  字幕が、何を選んだのかを伝えます。キーボードショートカットを使うときは、対象の要素の横に
  キーヒントのオーバーレイ（`⌘ + C`）が表示されます。
- **ページ読み込みの待ち時間は削られる**ので、動画は作業が始まるところから始まります。

## インストール

**Claude Code**

```bash
claude plugin marketplace add TOMOSIA-VIETNAM/webapp-evidence
claude plugin install webapp-evidence@webapp-evidence
```

**Cursor、Codex、Gemini CLI、Antigravity**

```bash
curl -fsSL https://raw.githubusercontent.com/TOMOSIA-VIETNAM/webapp-evidence/main/install.sh | bash
```

どのプラットフォームを使うかを尋ね、どこに何を置いたかを教えてくれます。録画には Chrome、ffmpeg、
Node がマシンに必要です。足りないものがあれば、エージェントが何が足りないかを伝え、インストール
を申し出ます。

このワンライナーは最新のリリースを、まだリリースがなければ `main` をインストールします。`--ref`
で別のものを選べます。指定は記憶されるので、あとで更新しても指定した場所に留まります:

```bash
curl -fsSL … /install.sh | bash -s -- --ref main       # a branch, to try a change before it ships
curl -fsSL … /install.sh | bash -s -- --ref v1.2.0     # a release, to pin a team to one version
curl -fsSL … /install.sh | bash -s -- --ref latest     # back to following releases
```

更新は `~/.webapp-evidence/scripts/install-local.sh --update`、削除は `--uninstall --all` です。
なお `install.sh` は常にデフォルトブランチから取得されるため、インストーラー自体への変更は
そこにマージされて初めて手元に届きます。

## 呼び出し方

| platform | how you call it |
|---|---|
| Claude Code | `/webapp-evidence:recording` |
| Cursor, Gemini CLI, Antigravity | `/webapp-evidence-recording` |
| Codex | `$webapp-evidence-recording` |

**タスクやバグ修正を終えた直後。** どの画面が変わったのかはエージェントが既に把握しているので、
後ろには何も書く必要がありません:

```
/webapp-evidence:recording
```

**手元にリンクしかない場合。** MR/PR の説明と差分を読み、何を録画すべきかを自分で判断します:

```
/webapp-evidence:recording https://gitlab.example.com/group/admin/-/merge_requests/1783
```

**コードを書かない人でも。** 上の例のように、ページと見せたい内容を伝えるだけです。リポジトリも
設定も、準備するものは何もありません。手順は自分が考えやすい言語で書いてください。エージェントは
同じ言語で返します。

覚えるべき構文もありません。「さっき直した画面の証跡を取って」と言えば、同じことが起こります。

## プロジェクトで使う

一度プロジェクトに向けておけば、入り方を覚えます:

```
/webapp-evidence:recording set up the evidence config for this project
```

ログイン画面を調べ、開発用アカウントを見つけ、`evidence.config.js` を書き出します。それ以降は
毎回の録画が、何も言わなくても動作する環境にサインインした状態から始まります。

変えたいことを言えば — 「もっとゆっくり録画して」「字幕は日本語で」「最新の録画だけ残して」 —
そのファイルを書き換えてくれます。

## 知っておきたい制限

録画の対象は画面全体ではなくページなので、オペレーティングシステムが描画するものはフレームの外に
出ます: `<select>` のドロップダウン、ファイル選択ダイアログ、`confirm`/`alert` のダイアログ。
これらの場面には、何を選んだかを伝える字幕と、その後の状態のスクリーンショットが付きます。JS で
作られたモーダル、日付ピッカー、ドロップダウンは通常どおり録画されます。

録画の対象はローカルの開発環境か、あなたが指定したサイトだけです。ステージングや本番は対象外です。

動画とスクリーンショットは Git に入りません。MR/PR への添付はご自身で行ってください。

---

上の録画は、このリポジトリのランナーが実際に出力したものです: `docs/demo/record.sh` が
`docs/demo/saucedemo-steps.js` から生成しています。スキル自体に手を入れる場合は
**[CONTRIBUTING.md](./CONTRIBUTING.md)** を参照してください。
