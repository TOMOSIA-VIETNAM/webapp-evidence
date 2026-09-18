<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./docs/images/logo/logo-lockup-dark.svg">
    <img src="./docs/images/logo/logo-lockup.svg" alt="webapp-evidence" width="420">
  </picture>
</p>

<p align="center">
  <strong>描述操作，拿到录制。</strong><br>
  <sub>一条命令录制你的 Web 应用，返回视频、截图和运行手册。用于 UAT、交接、缺陷报告和评审。</sub><br>
  <code>/webapp-evidence:recording</code>
</p>

<p align="center">
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

证明一个功能可用，往往要花半小时录屏，出来的视频还是不好看：截图慢半拍、指针乱跳、下拉框没拍到打开
的瞬间。换个做法：把操作描述给你的编码 agent。它驱动 Chrome，交回视频、关键步骤的截图，以及一份能
复现同一次录制的运行手册。

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

## 第一次录制

把页面和步骤交给它，用你自己的话：

```
/webapp-evidence:recording Page: https://app.example.com/search
Flow:
1. Search for "abc" with status Active
2. Open the first row, then close the detail panel
3. Export the result to CSV
```

回来的是 `<name>.mp4`、按顺序编号的截图，以及 `<name>-runbook.md` —— 时间线、字幕、录制中出现的页
面错误，还有产生这次录制的命令。直接附到工单、MR 或报告里；没有任何东西被提交进 Git，也没有任何东
西被发往别处。

没有语法要背：*“给我刚修的那个页面的证据”* 就够了，用什么语言写，agent 就用什么语言回。在哪里输入：

| 平台 | 命令 |
|---|---|
| Claude Code | `/webapp-evidence:recording` |
| Cursor, Gemini CLI, Antigravity | `/webapp-evidence-recording` |
| Codex | `$webapp-evidence-recording` |

## 一次录制，三种证据

录屏只能证明全栈改动的一半。同一次录制还可以用浏览器已经持有的会话调用 API，并把数据库读回来 ——
一个视频，一份运行手册：

```
/webapp-evidence:recording Page: https://app.example.com/orders
Flow:
1. Create an order for SKU ABC, quantity 2
2. Call POST /api/orders and show it answering 201
3. Query the orders table and show the row that appeared
```

- **页面。** 表单由一个看得见的指针填写并提交，节奏是观看者读得过来的速度。
- **接口。** 页面上方打开一个终端面板，curl 在里面用浏览器自己的 Cookie 运行 —— `HTTP 201 in
  0.184s` 留在画面里。这一步会断言状态码，所以状态不对就是录制失败，而不是把错误当证据发出去。
- **数据库。** `psql`、`mysql`、一个 rake 任务 —— 你平时自己敲的东西，在同一个面板里执行，新增的那
  一行与创建它的页面同框。

Cookie 和令牌通过文件交给 curl，并在视频、截图和运行手册中全部被遮蔽。

## 一次录制长什么样

<p align="center">
  <img src="./docs/demo/site-tour.gif" width="820" alt="落地页浏览录制：hero 区的飞蛾跟随指针，安装命令被复制、按钮确认已复制，然后页面一路读下去 —— How it works、逐步点击的评审轮次演示，以及功能卡片。">
</p>

这个 gif 只是较长录制中的一段。与它一起的运行手册说明视频里有什么，让对面的人可以读，而不必看：

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

录制过程中它同时盯着控制台和网络：没人注意到的那个请求返回 401，会带着状态码和 URL 落在最后一块
里。如果录制就发生在你开发该功能的会话中，agent 会像跑了一轮 e2e 那样回看这些截图和错误，并提出修
法，而不只是把文件交给你。

## 怎么提要求

| 你想要 | 这样输入 |
|---|---|
| 刚改完的页面的证据 | `/webapp-evidence:recording` —— 它知道你刚在做什么 |
| 给 MR 或 PR 的证据 | `/webapp-evidence:recording https://gitlab.example.com/group/admin/-/merge_requests/1783` |
| 数据变了之后再录一次同样的 | `/webapp-evidence:recording record that again` —— 旧的保留为 `v1`、`v2`…… |
| 录慢一点，或换一种字幕语言 | `/webapp-evidence:recording record it slower`、`captions in Japanese` —— 按项目记住 |
| 把密钥挡在录制之外 | `/webapp-evidence:recording blur the API key when it appears` |
| 让下拉框或对话框本身入镜 | `/webapp-evidence:recording --screen` —— 录浏览器窗口，所以操作系统画的东西也在画面里 |
| 无论流程如何都不占用屏幕 | `/webapp-evidence:recording --headless` —— 默认行为，也是把这个问题直接定下来的方式 |
| 给 README 用的 gif，或自己托管页面用的 webm | `/webapp-evidence:recording -f gif`、`-f webm` —— 其余情况是 mp4，因为它到哪都能内联播放 |
| 不看视频也知道里面是什么 | `/webapp-evidence:vision <the mp4>` |
| 录制一开始就是已登录状态 | `/webapp-evidence:recording set up the evidence config for this project` |
| 告诉我们哪里不对、还缺什么 | `/webapp-evidence:feedback` |

`vision` 存在是因为 agent 看不了视频。它把视频铺成一张张图 —— 每隔几秒一帧，每帧都打上 `mm:ss` ——
所以结论会是“00:14 处表头压住了表格”，这个时间点你可以自己核对，也能对上运行手册。上面那次录制生成
的图：
**[1](./docs/demo/vision-sheet-01.png)** ·
**[2](./docs/demo/vision-sheet-02.png)** ·
**[3](./docs/demo/vision-sheet-03.png)**。

## 限制

它录的是页面，不是你的屏幕。操作系统画的东西不会进视频：`<select>` 下拉框、文件选择框、
`confirm`/`alert` 对话框。每一个都会配一条说明选了什么的字幕，以及紧接其后的状态截图；模态框、日期
选择器和 JS 写的下拉框都能正常录到。当这些对话框本身*就是*证据时，`--screen` 改为录制浏览器窗口 ——
这需要一块屏幕、你的许可，以及录制期间不碰这台机器，所以 agent 会先问。

终端面板只接受按行输出的命令：`vim`、`less` 和 `htop` 除外。一次录制只针对你指定的站点，不碰别的。

固定版本或跟随某个分支：

```bash
curl -fsSL https://raw.githubusercontent.com/TOMOSIA-VIETNAM/webapp-evidence/main/install.sh | bash -s -- --ref main
```

`--ref v1.1.3` 固定一个发布版，`--ref latest` 回到跟随发布，之后每次运行都保持最后一次指定的选择。
更新用 `~/.webapp-evidence/scripts/install-local.sh --update`，卸载用 `--uninstall --all`。

---

上面的录制是本仓库 runner 的真实产物：`docs/demo/record.sh` 从 `docs/demo/site-tour-steps.js` 生
成。想改动技能本身，见 **[CONTRIBUTING.md](./CONTRIBUTING.md)**。
