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
/webapp-evidence:recording Page: https://www.saucedemo.com
Flow:
1. Log in using standard_user / secret_sauce
2. Change the sort dropdown to "Price (low to high)"
3. Add "Sauce Labs Backpack" to the cart, then open the cart
4. Checkout, fill First Name / Last Name / Zip as Minh / Tang / 700000
5. Continue, then Finish, and stop at the "Thank you for your order!" screen
```

## 结果

<p align="center">
  <img src="./docs/demo/saucedemo.gif" width="820" alt="Swag Labs 结账流程录像：登录，按价格排序商品（下拉菜单由操作系统绘制、录不进画面，所以底部字幕说明选了哪一项），把背包加入购物车，填写结账表单，完成订单。">
</p>

八张关键步骤的截图，外加一份 runbook。收到的人读一遍就够，不一定要看视频：

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

录制时它也会看控制台和网络。所以这里能看到页面在返回 401——截图看不出来，一般也不会有人去查。

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

加上 `--ref main` 或 `--ref v1.2.0` 就能跟着某个分支走或钉在某个版本，`--ref latest` 回到跟随
发布版本；更新用 `~/.webapp-evidence/scripts/install-local.sh --update`，卸载用
`--uninstall --all`。

## 使用方式

怎么调用，取决于你在哪个工具里：

| 平台 | 命令 |
|---|---|
| Claude Code | `/webapp-evidence:recording` |
| Cursor, Gemini CLI, Antigravity | `/webapp-evidence-recording` |
| Codex | `$webapp-evidence-recording` |

能跟它要的东西：

| 你想要 | 怎么说 |
|---|---|
| 刚改完的那个界面的证据 | 命令后面什么都不用写——你在弄哪个界面，它知道 |
| MR/PR 的证据 | 把链接贴上；它会读描述和 diff |
| 按你的描述录一个页面 | 写 `Page: <url>` 加上步骤，像上面的例子那样 |
| 同样的录制再来一遍，或者录慢一点 | 说一声即可——命令留在 runbook 里，旧的录制也不会被覆盖 |
| 字幕换一种语言 | 说要哪种；它会按项目记住 |
| 给项目配一次，以后每次录制都从已登录状态开始 | `set up the evidence config for this project` |

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

## 限制

它录的是页面，不是你的屏幕。操作系统画的东西进不了视频：`<select>` 下拉菜单、文件选择框、
`confirm`/`alert` 对话框。这些时刻会配一条字幕说明选了什么，再加一张之后状态的截图。用 JS 做的
模态框、日期选择器和下拉菜单都能正常录进去。

录制只针对本地开发环境或你指定的站点——不碰预发布，也不碰生产。

视频和截图不进 Git。贴到工单、MR/PR 还是报告，由你自己决定。

---

上面那段录制是本仓库 runner 的真实输出：`docs/demo/record.sh` 从
`docs/demo/saucedemo-steps.js` 生成。想改这个技能本身，见
**[CONTRIBUTING.md](./CONTRIBUTING.md)**。
