<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./docs/images/logo/logo-lockup-dark.svg">
    <img src="./docs/images/logo/logo-lockup.svg" alt="Webapp Evidence" width="420">
  </picture>
</p>

<h3 align="center">描述流程，拿回录制。</h3>

<p align="center">
  <sub>
    <a href="./README.md">English</a> · <a href="./README.vi-VN.md">Tiếng Việt</a> · <a href="./README.ja-JP.md">日本語</a> · <strong>简体中文</strong>
    &nbsp;&nbsp;|&nbsp;&nbsp; <a href="https://evdrec.vercel.app">evdrec.vercel.app</a> · <a href="./LICENSE">MIT</a>
  </sub>
</p>

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./docs/images/readme/pipeline.zh-Hans-dark.svg">
    <img src="./docs/images/readme/pipeline.zh-Hans.svg" width="900" alt="描述流程，agent 驱动 Chrome，交回视频、截图和 runbook">
  </picture>
</p>

<p align="center">
  <a href="https://evdrec.vercel.app"><img src="./docs/demo/evd-tour.gif" width="820" alt="webapp-evidence 的落地页录下它自己：复制命令，页面上方打开一个终端面板读回页面返回的 SEO 元数据，然后在 UAT 报告里逐条选择验收标准，证明它的运行手册行随之亮起。"></a><br>
  <sub>本项目自己的落地页，由它介绍的 skill 亲自录制。一次录制，没有剪辑。</sub>
</p>

## 一次录制能证明什么

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./docs/images/readme/proofs.zh-Hans-dark.svg">
    <img src="./docs/images/readme/proofs.zh-Hans.svg" width="900" alt="一次录制里有页面、用浏览器会话调用的接口，以及数据库里的那一行">
  </picture>
</p>

```
/webapp-evidence:recording Page: https://app.example.com/orders
Flow:
1. Create an order for SKU ABC, quantity 2
2. Call POST /api/orders and show it answering 201
3. Query the orders table and show the row that appeared
```

<sub>Cookie 和令牌走文件交给 curl，所以不会出现在你敲出的命令行里。这一步会断言状态码：状态不对，录制直接失败，
而不会把错误当成证据发出去。也没有任何内容会被自动遮盖：`recording.terminal.scrub` 里的模式，只替换它匹配到的
文本。</sub>

## 为 UAT 而生

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./docs/images/readme/uat.zh-Hans-dark.svg">
    <img src="./docs/images/readme/uat.zh-Hans.svg" width="900" alt="写下标准，录制一次，读 runbook，签字验收；修复后再录一次">
  </picture>
</p>

<p align="center"><sub>上面的录制，就是这个循环在本项目自家网站上跑的一遍：
<a href="https://evdrec.vercel.app">evdrec.vercel.app</a> 把自己的录制当 UAT 报告读了回来。</sub></p>

## 不用你开口

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./docs/images/readme/traits.zh-Hans-dark.svg">
    <img src="./docs/images/readme/traits.zh-Hans.svg" width="900" alt="像人在操作，看完再改，发现控制台错误，不离开你的机器">
  </picture>
</p>

<details>
<summary><b>runbook 长什么样</b> —— 上面那次录制，按接收方读到的样子</summary>

```markdown
## Steps in the video

00:05 - 00:17  Terminal — the SEO meta the page serves, read off its URL
00:24 - 00:40  UAT report — each criterion picks out the runbook lines that prove it
00:58 - 01:06  Install — one panel per agent

## Commands run in the terminal

- 00:12  `curl -s https://evdrec.vercel.app/ | grep -oE '<title>[^<]*</title>|…'` — exit 0

## Page errors recorded during the take

- none
```

</details>

## 读回一次录制

agent 看不了视频。`vision` 把视频按固定间隔抽帧，每帧打上 `mm:ss` 拼成联系表 —— 于是结论会变成
*“00:14 处表头压住了表格”*，这个时间点正好对上 runbook。上面那次录制，就是 agent 眼中的样子：

<p align="center">
  <a href="./docs/demo/vision-sheet-01.png"><img src="./docs/demo/vision-sheet-01.png" width="268" alt="上面那次录制的联系表 1"></a>
  <a href="./docs/demo/vision-sheet-02.png"><img src="./docs/demo/vision-sheet-02.png" width="268" alt="上面那次录制的联系表 2"></a>
  <a href="./docs/demo/vision-sheet-03.png"><img src="./docs/demo/vision-sheet-03.png" width="268" alt="上面那次录制的联系表 3"></a>
</p>

## 安装

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./docs/images/readme/platforms.zh-Hans-dark.svg">
    <img src="./docs/images/readme/platforms.zh-Hans.svg" width="900" alt="在 Claude Code、Cursor、Codex、Gemini CLI 和 Antigravity 中运行">
  </picture>
</p>

**Claude Code**

```bash
claude plugin marketplace add TOMOSIA-VIETNAM/webapp-evidence
claude plugin install webapp-evidence@webapp-evidence
```

**Cursor, Codex, Gemini CLI, Antigravity**

```bash
curl -fsSL https://raw.githubusercontent.com/TOMOSIA-VIETNAM/webapp-evidence/main/install.sh | bash
```

它会先问你用哪个平台，再告诉你文件都放在哪里。录制需要 Chrome、ffmpeg 和 Node；缺哪个 agent 会点名，并主动
提出替你装上。

在哪里输入命令取决于平台：Claude Code 用 `/webapp-evidence:recording`，Cursor、Gemini CLI 和 Antigravity
用 `/webapp-evidence-recording`，Codex 用 `$webapp-evidence-recording`。

录制时，运行器会通过 `gh` 查询你的 GitHub 账号是否已给本仓库加星，直到得到答复。
若尚未加星，智能体会在最后问你一次是否加星；未经你同意，不会向 GitHub 写入任何内容。
设置 `STAR_CHECK=0` 可关闭此检查。

<details>
<summary><b>固定发布版、更新、卸载</b></summary>

```bash
curl -fsSL https://raw.githubusercontent.com/TOMOSIA-VIETNAM/webapp-evidence/main/install.sh | bash -s -- --ref v1.1.3
```

`--ref main` 跟随分支，`--ref latest` 跟随最新发布版；之后每次运行都沿用最后一次的指定。更新用
`~/.webapp-evidence/scripts/install-local.sh --update`，卸载用 `--uninstall --all`。

</details>

## 怎么提要求

没有语法要学。*“给我刚修的那个页面的证据”* 就能跑，用什么语言写，agent 就用什么语言回。

| 你想要 | 这样输入 |
|---|---|
| 刚改完的页面的证据 | `/webapp-evidence:recording` |
| 给 MR 或 PR 的证据 | `/webapp-evidence:recording https://gitlab.example.com/group/admin/-/merge_requests/1783` |
| 数据变了，再录一次同样的 | `record that again` —— 旧的保留为 `v1`、`v2`…… |
| 录慢一点，或换个字幕语言 | `record it slower`、`captions in Japanese` —— 按项目记住 |
| 看完再改 | `cover the API key in step 3`、`twice as fast` |
| 让系统下拉框或对话框也入镜 | `--screen` —— 录浏览器窗口 |
| 任何流程都不占用屏幕 | `--headless` —— 默认行为，一步到位 |
| 给 README 用的 gif，自己托管页面用的 webm | `-f gif`、`-f webm` —— 其余是 mp4 |
| 不看视频也知道里面是什么 | `/webapp-evidence:vision <the mp4>` |
| 录制一开始就是已登录状态 | `set up the evidence config for this project` |
| 告诉我们哪里不对、还缺什么 | `/webapp-evidence:feedback` |

## 限制

它录的是页面，不是你的屏幕：`<select>` 菜单、文件选择框、`confirm`/`alert` 会用字幕加截图代替 ——
或者用 `--screen`，agent 会先问你。终端面板只接受逐行输出，所以 `vim`、`less`、`htop` 就别想了。

---

<sub>这里的每张图都由 `docs/images/readme/build-readme-art.py` 绘制；录制是在 `webapp/` 上运行
`docs/demo/record.sh` 得到的。想参与 skill 本身的开发，请看 **[CONTRIBUTING.md](./CONTRIBUTING.md)**。</sub>
