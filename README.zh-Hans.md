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

你总要向别人证明应用真的能跑：UAT、交接给另一个团队、报 bug、演示、评审。自己录大概要
半小时，效果还是不好——截图慢半拍，鼠标乱跳，下拉菜单在画面里打不开，别人看不出你选了什么。

把流程告诉编码代理就行。它操作 Chrome，返回视频、关键步骤的截图，以及能复现这次录制的 runbook。

## 示例

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

## 结果

<p align="center">
  <img src="./docs/demo/site-tour.gif" width="820" alt="落地页导览录像：hero 里的飞蛾跟着指针反应，复制一行安装命令后按钮自己确认，接着一路往下读页面 —— How it works、逐步点开的评审轮次讲解，以及功能卡片。">
</p>

GIF 只是整段录制里的一截 —— 整段做成 GIF 会大上好几倍，README 不该放那种东西。随附 25 张主要步骤截图，以及一份 runbook，对方读完就懂，不必看视频：

```markdown
## Steps in the video

00:00 - 00:01  Hero — the page as it opens
00:01 - 00:15  Language menu — every language the site ships
00:15 - 00:19  Back to English — the language the rest of the tour runs in
00:19 - 00:21  Hero — the moth answers the pointer
00:21 - 00:26  Hero — copy the one-line install command
00:26 - 00:32  How it works — the three steps light up under the pointer
00:32 - 00:36  Review rounds — the walkthrough plays itself
00:36 - 00:49  Review rounds — every step of the loop, picked by hand
00:49 - 00:54  Features — the cards warm as the pointer crosses them
00:54 - 00:56  Token cost — the chart the plugin publishes
00:56 - 01:03  Install — one panel per agent
01:03 - 01:05  Install — copy the command of the open panel
01:05 - 01:09  Footer — the links at the end of the page
01:09 - 01:13  The floating button flies the reader back to the top
01:13 - 01:26  The SEO meta the page serves, read straight off the URL
01:26 - 01:32  Closing on 日本語

## Captions shown in the video

- 00:23  The command is on the clipboard. The button was read back for its "Copied"
         state, because a blocked clipboard leaves a click that proves nothing.
- 01:13  The terminal panel runs against the live URL, so these tags come from what
         the site is serving right now.

## Commands run in the terminal

- 01:24  `curl -s https://open-pr.vercel.app/ | grep -oE '<title>[^<]*</title>|…'` — exit 0

## Page errors recorded during the take

- none
```

录制时它也盯着 console 和网络。这一次页面是干净的 —— 这本身就是读者可以核实的说法。出问题时，
每条错误都会带着状态码和 URL 落在最后那一块里 —— 没人留意的请求返回 401，截图是照不出来的。

如果是在实现功能的同一轮对话里录的，代理会按 e2e 的方式看这些截图和错误日志。401、布局错位或
溢出——发现问题可以提出修法，不只是把文件交给你。

runbook 里还留着生成这次录制的命令。数据变了、视频坏了、或者想录慢一点，再说一次就行。旧的录制
会保留为 `v1`、`v2`、……，不会被覆盖。已经发出去的录像，没法再生成同一份文件。

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

它会问你用哪个平台，然后告诉你装到了哪里。录制需要 Chrome、ffmpeg 和 Node——缺哪个，代理会说
清楚，并提出帮你装上。

要跟着某个分支走或钉在某个版本：

```bash
curl -fsSL https://raw.githubusercontent.com/TOMOSIA-VIETNAM/webapp-evidence/main/install.sh | bash -s -- --ref main
```

`--ref v1.2.0` 钉在某个版本，`--ref latest` 回到跟随发布版本；之后每次运行都保持最后一次指定的
那个。更新用 `~/.webapp-evidence/scripts/install-local.sh --update`，卸载用 `--uninstall --all`。

## 使用方式

怎么调用，取决于你在哪个工具里：

| 平台 | 命令 |
|---|---|
| Claude Code | `/webapp-evidence:recording` |
| Cursor, Gemini CLI, Antigravity | `/webapp-evidence-recording` |
| Codex | `$webapp-evidence-recording` |

能跟它要的东西：

| 你想要 | 输入什么 |
|---|---|
| 刚改完的页面的证据 | `/webapp-evidence:recording` —— 它知道你刚在做什么 |
| 某个 MR 或 PR 的证据 | `/webapp-evidence:recording https://gitlab.example.com/group/admin/-/merge_requests/1783` |
| 按你的描述录一个页面 | `/webapp-evidence:recording Page: https://app.example.com/search` 然后写步骤，就像上面的例子 |
| 再录一遍同样的内容 | `/webapp-evidence:recording 再录一遍` —— 命令在 runbook 里，旧的录制不会被覆盖 |
| 录慢一点 | `/webapp-evidence:recording 录慢一点` |
| 换一种语言的字幕 | `/webapp-evidence:recording 字幕用日文` —— 按项目记住 |
| 证明这次点击真的到了后端——任务跑了、文件写了 | `/webapp-evidence:recording 点击 Run sync 之后展示 worker 日志` |
| 想让下拉菜单或对话框本身进视频，而不是一条字幕 | `/webapp-evidence:recording --screen` —— 把机器交出去约一分钟；不加这个参数它会先问你 |
| 把敏感信息挡在录制之外 | `/webapp-evidence:recording API key 出现时把它模糊掉` |
| 给项目配一次，以后录制都已登录 | `/webapp-evidence:recording set up the evidence config for this project` |

步骤用你平时用的那种语言写就行，代理也用同一种语言回你。也没有语法要记——说“给我刚修好的那个
界面的证据”，一样能跑。

## 拿到录制之后

| 你想要 | 命令 |
|---|---|
| 一个 gif，放进 README 或任何只渲染图片的地方 | `/webapp-evidence:recording -f gif` |
| 一个 webm，放到你自己的页面上 | `/webapp-evidence:recording -f webm` |
| 不看视频也知道里面发生了什么 | `/webapp-evidence:vision <the mp4>` |
| 反馈一个问题，或者提一个缺的功能 | `/webapp-evidence:feedback` |

默认仍然是 mp4：它在 merge request、issue 和各种聊天工具里都能直接播放，也是三种格式里最小的。
同一段录制转成 gif 会大好几倍，所以这一步是先问你一句，而不是给你一个意外。

`vision` 存在的原因是代理看不了视频。它把视频拼成图片网格——每隔几秒一帧，每帧标着
`mm:ss`——然后当图片来读。所以结论会是“00:14 处标题压住了表格”：一个你能自己回看核对、也能和
runbook 对上的时刻。它还能发现没人想到要截图的东西：过渡途中错位的布局，闪一下就没了的横幅。

这是它从上面那段录制里生成的两张图：
**[第 1 张](./docs/demo/vision-sheet-01.png)**（00:00–00:38）·
**[第 2 张](./docs/demo/vision-sheet-02.png)**（00:40–01:18）·
**[第 3 张](./docs/demo/vision-sheet-03.png)**（01:20–01:32）。

## 限制

它录的是页面，不是你的屏幕。操作系统画的东西进不了视频：`<select>` 下拉菜单、文件选择框、
`confirm`/`alert` 对话框。这些时刻会配一条字幕说明选了什么，再加一张之后状态的截图。用 JS 做的
模态框、日期选择器和下拉菜单都能正常录进去。

如果要展示的正是这些对话框，它可以改成录浏览器窗口，那样对话框就在视频里了。这需要一块屏幕、
相应权限，而且整段录制期间不能碰这台机器，所以不是默认行为——代理会先问你，屏幕上也会弹出一条
提示，告诉你问题在哪里。想直接指定就用 `/webapp-evidence:recording --screen`。

屏幕上出现的敏感信息可以模糊、涂黑，或者把那一段从录制里剪掉——描述流程时说一声即可，截图也
会同样处理。

如果证据根本不在页面上——任务跑过了、文件写好了——某一步可以在页面上方打开一个终端面板，
把真实的命令和真实的输出录进同一个视频。只支持按行输出的命令：`vim`、`less`、`htop` 不行。

录制只针对你指定的站点，不碰别的。

视频和截图不进 Git。贴到工单、MR/PR 还是报告，由你自己决定。

---

上面那段录制是本仓库 runner 的真实输出：`docs/demo/record.sh` 从
`docs/demo/site-tour-steps.js` 生成。想改这个技能本身，见
**[CONTRIBUTING.md](./CONTRIBUTING.md)**。
