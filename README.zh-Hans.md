<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./docs/images/logo/logo-lockup-dark.svg">
    <img src="./docs/images/logo/logo-lockup.svg" alt="webapp-evidence" width="420">
  </picture>
</p>

<p align="center">
  <strong>把流程告诉它，就能拿到录像。</strong><br>
  <sub>一条命令录下 Web 应用，返回视频、截图和 runbook。用于 UAT、交接、缺陷报告和评审。</sub><br>
  <code>/webapp-evidence:recording</code>
</p>

<p align="center">
  <a href="https://evdrec.vercel.app"><img alt="Website: evdrec.vercel.app" src="https://img.shields.io/badge/website-evdrec.vercel.app-5C8F0F?style=flat-square"></a>
  <a href="./LICENSE"><img alt="License: MIT" src="https://img.shields.io/github/license/TOMOSIA-VIETNAM/webapp-evidence?style=flat-square&color=blue"></a>
  <a href="#安装"><img alt="Claude Code" src="https://img.shields.io/badge/Claude_Code-supported-D97757?style=flat-square&logo=anthropic&logoColor=white"></a>
  <a href="#安装"><img alt="Cursor" src="https://img.shields.io/badge/Cursor-supported-000000?style=flat-square&logo=cursor&logoColor=white"></a>
  <a href="#安装"><img alt="Codex" src="https://img.shields.io/badge/Codex-supported-412991?style=flat-square&logo=openai&logoColor=white"></a>
  <a href="#安装"><img alt="Gemini CLI" src="https://img.shields.io/badge/Gemini_CLI-supported-4285F4?style=flat-square&logo=google&logoColor=white"></a>
  <a href="#安装"><img alt="Antigravity" src="https://img.shields.io/badge/Antigravity-supported-6E56CF?style=flat-square"></a>
</p>

<p align="center">
  <a href="./README.md">English</a> · <a href="./README.vi-VN.md">Tiếng Việt</a> · <a href="./README.ja-JP.md">日本語</a> · <strong>简体中文</strong>
</p>

AI 让改动变快了，证明它能跑却没有变快 —— UAT、交接、缺陷报告和评审要的都是同一样东西，而自己录一遍
仍然要花半小时。

**`webapp-evidence` 替你把这份证据录下来。** 把流程告诉你已经在用的编码 agent，它驱动 Chrome，交回
视频、关键步骤的截图，以及一份 runbook。

<p align="center">
  <a href="https://evdrec.vercel.app"><img src="./docs/demo/evd-tour.gif" width="820" alt="webapp-evidence 的落地页录下它自己：复制命令，页面上方打开一个终端面板读回页面返回的 SEO 元数据，然后在 UAT 报告里逐条选择验收标准，证明它的运行手册行随之亮起。"></a><br>
  <sub>本项目自己的落地页，由它介绍的 skill 亲自录制。一次录制，没有剪辑。</sub>
</p>

- **一次录制，三种证据** —— 页面、用浏览器自己持有的会话调用的接口，以及它写进数据库的那一行。一个
  视频，一份 runbook。
- **看上去像人在操作** —— 指针会移动，敲键盘的节奏不均匀，滚动停在它要去的地方。没有任何跳变。
- **给的是 runbook，不只是文件** —— 时间线、字幕、执行过的命令、记录到的页面错误，以及再录一次同样
  内容的命令。
- **密钥留在外面** —— 模糊、涂黑，或者把那一段直接剪掉，视频和截图一视同仁。
- **没有东西离开你的机器** —— 没有服务，没有机器人账号；它在你本来就有的 agent CLI 里运行，只针对你
  指定的站点。

## 为 UAT 而生

验收测试依然是有人逐条点击每个标准、再手动录下来。改为把标准写成一个流程，再按时间戳签字：

| 1 · 写标准 | 2 · 录一次 | 3 · 读 runbook | 4 · 签字 |
|---|---|---|---|
| 用平常的话写编号步骤，任何语言都行 —— 或者给一个 MR/PR 链接，agent 从 diff 推导出流程。 | 用可见的指针驱动 Chrome。调用接口的步骤会断言状态码，响应不对录制就停下。 | 每一步在视频里的时间、每条命令的退出码、每个控制台错误和失败请求。 | 评审者按时间戳逐条核对标准，不必重跑流程。修复之后，`record that again`。 |

上面的录制就是这个循环在本项目自己网站上跑的一遍：
**[evdrec.vercel.app](https://evdrec.vercel.app)** 把自己的录制当作 UAT 报告读回来。

## 一次录制能证明什么

录屏只能证明全栈改动的一半。同一次录制还可以用浏览器已经持有的会话调用 API，并把数据库读回来：

```
/webapp-evidence:recording Page: https://app.example.com/orders
Flow:
1. Create an order for SKU ABC, quantity 2
2. Call POST /api/orders and show it answering 201
3. Query the orders table and show the row that appeared
```

- **页面。** 表单由一个看得见的指针填写并提交，节奏是观看者读得过来的速度。
- **接口。** 页面上方打开一个终端面板，curl 在里面用浏览器的 Cookie 运行 —— `HTTP 201 in 0.184s`
  留在画面里。这一步会断言状态码，所以状态不对就是录制失败，而不是把错误当证据发出去。
- **数据库。** `psql`、`mysql`、一个 rake 任务 —— 你平时自己敲的东西，在同一个面板里执行，新增的那
  一行与创建它的页面同框。

Cookie 和令牌通过文件交给 curl，并在视频、截图和 runbook 中全部被遮蔽。

## 拿回什么

`<name>.mp4`、按顺序编号的截图，以及 `<name>-runbook.md` —— 让对面的人可以读，而不必看。来自上面那次录制：

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

录制过程中它同时盯着控制台和网络，所以没人留意的那个请求返回 401，会带着状态码和 URL 落在最后一块
里。如果录制就发生在你开发该功能的会话中，agent 会像跑了一轮 e2e 那样回看这些截图和错误，并提出修
法，而不只是把文件交给你。

没有任何东西被提交进 Git。附到工单、MR 还是报告，由你决定。

## 安装

**Claude Code**

```bash
claude plugin marketplace add TOMOSIA-VIETNAM/webapp-evidence
claude plugin install webapp-evidence@webapp-evidence
```

**Cursor, Codex, Gemini CLI, Antigravity**

```bash
curl -fsSL https://raw.githubusercontent.com/TOMOSIA-VIETNAM/webapp-evidence/main/install.sh | bash
```

它会询问你用哪个平台，并告诉你文件落在哪里。录制需要 Chrome、ffmpeg 和 Node；缺哪个 agent 会点名，
并提出替你安装。

固定某个发布版，或者跟随某个分支：

```bash
curl -fsSL https://raw.githubusercontent.com/TOMOSIA-VIETNAM/webapp-evidence/main/install.sh | bash -s -- --ref v1.1.3
```

`--ref main` 跟随分支，`--ref latest` 回到跟随发布版；之后每次运行都保持最后一次指定的那个。更新用
`~/.webapp-evidence/scripts/install-local.sh --update`，卸载用 `--uninstall --all`。

在哪里输入命令取决于平台：Claude Code 用 `/webapp-evidence:recording`，Cursor、Gemini CLI 和
Antigravity 用 `/webapp-evidence-recording`，Codex 用 `$webapp-evidence-recording`。

## 怎么提要求

没有语法要学。*“给我刚修的那个页面的证据”* 就能跑，用什么语言写，agent 就用什么语言回。

| 你想要 | 这样输入 |
|---|---|
| 刚改完的页面的证据 | `/webapp-evidence:recording` —— 它知道你刚在做什么 |
| 给 MR 或 PR 的证据 | `/webapp-evidence:recording https://gitlab.example.com/group/admin/-/merge_requests/1783` |
| 数据变了之后再录一次同样的 | `/webapp-evidence:recording record that again` —— 旧的保留为 `v1`、`v2`…… |
| 录慢一点，或换一种字幕语言 | `record it slower`、`captions in Japanese` —— 按项目记住 |
| 把密钥挡在录制之外 | `blur the API key when it appears` |
| 让下拉框或对话框本身入镜 | `--screen` —— 录浏览器窗口，所以操作系统画的东西也在画面里 |
| 无论流程如何都不占用屏幕 | `--headless` —— 默认行为，也是把这个问题直接定下来的方式 |
| 给 README 用的 gif，自己托管页面用的 webm | `-f gif`、`-f webm` —— 其余情况是 mp4，因为它到哪都能内联播放 |
| 不看视频也知道里面是什么 | `/webapp-evidence:vision <the mp4>` —— 见下文 |
| 录制一开始就是已登录状态 | `/webapp-evidence:recording set up the evidence config for this project` |
| 告诉我们哪里不对、还缺什么 | `/webapp-evidence:feedback` |

## 读回一次录制

agent 看不了视频。`vision` 把视频按固定间隔取帧，每帧打上 `mm:ss`，拼成联系表 —— 所以结论会是
“00:14 处表头压住了表格”，这个时间点能对上 runbook。上面那次录制，就是 agent 读到的样子：

<p align="center">
  <a href="./docs/demo/vision-sheet-01.png"><img src="./docs/demo/vision-sheet-01.png" width="268" alt="上面那次录制的联系表 1"></a>
  <a href="./docs/demo/vision-sheet-02.png"><img src="./docs/demo/vision-sheet-02.png" width="268" alt="上面那次录制的联系表 2"></a>
  <a href="./docs/demo/vision-sheet-03.png"><img src="./docs/demo/vision-sheet-03.png" width="268" alt="上面那次录制的联系表 3"></a>
</p>

## 限制

它录的是页面，不是你的屏幕，所以操作系统画的东西进不了视频：`<select>` 下拉框、文件选择框、
`confirm`/`alert` 对话框。每一个都会配一条说明选了什么的字幕，以及紧接其后的状态截图；模态框、日期
选择器和 JS 写的下拉框都能正常录到。当这些对话框本身*就是*证据时，`--screen` 改为录制浏览器窗口 ——
这需要一块屏幕、你的许可，以及录制期间不碰这台机器，所以 agent 会先问。

终端面板只接受按行输出的命令：`vim`、`less` 和 `htop` 除外。

---

上面的录制是本仓库 runner 的真实产物：`docs/demo/record.sh` 按 `docs/demo/tour-steps.js` 录制
`webapp/` 里的网站，同一次录制也在 [evdrec.vercel.app](https://evdrec.vercel.app) 上播放。想改动技能本身，见
**[CONTRIBUTING.md](./CONTRIBUTING.md)**。
