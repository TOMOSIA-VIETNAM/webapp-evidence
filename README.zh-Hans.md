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

## 和自己录有什么不一样

- **光标可见，移动比较自然。** 走曲线，先快后慢，点得远时会稍微冲过再回来。每次点击有一圈小波纹。
- **节奏跟着画面走。** 只是跳转的点击走得快；结果出现时会停到足够读完。
- **录不到的用字幕补。** `<select>` 菜单和文件选择框由操作系统绘制，进不了页面录制，所以底部
  字幕会说明选了什么。快捷键会在它作用的元素旁边显示按键提示（`⌘ + C`）。
- **页面加载的等待被剪掉了**，视频从真正开始操作的地方开始。

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

这条一行命令装的是最新发布版本；还没有发布版本时装 `main`。想选别的就用 `--ref`，这个选择会被
记住，以后更新仍然停在你指定的位置：

```bash
curl -fsSL … /install.sh | bash -s -- --ref main       # a branch, to try a change before it ships
curl -fsSL … /install.sh | bash -s -- --ref v1.2.0     # a release, to pin a team to one version
curl -fsSL … /install.sh | bash -s -- --ref latest     # back to following releases
```

更新用 `~/.webapp-evidence/scripts/install-local.sh --update`，卸载用 `--uninstall --all`。
注意：`install.sh` 始终从默认分支下载，所以安装脚本自身的修改，要合并进去之后才会到你手上。

## 三种调用方式

| platform | how you call it |
|---|---|
| Claude Code | `/webapp-evidence:recording` |
| Cursor, Gemini CLI, Antigravity | `/webapp-evidence-recording` |
| Codex | `$webapp-evidence-recording` |

**刚做完一个任务或修完一个缺陷。** 哪个界面变了，代理已经知道，后面什么都不用写：

```
/webapp-evidence:recording
```

**手上只有一个 MR/PR 链接。** 它会读描述和 diff，自己判断该录什么：

```
/webapp-evidence:recording https://gitlab.example.com/group/admin/-/merge_requests/1783
```

**不写代码。** 像上面的例子那样，给出页面、说清要看到什么。不需要仓库，不需要配置，什么都不用
搭。步骤用你正在用的那种语言写就行；代理用同一种语言回你。

也没有语法要记。说“给我刚修好的那个界面的证据”，结果是一样的。

## 给项目做一次配置

```
/webapp-evidence:recording set up the evidence config for this project
```

它会找到登录界面和一个开发账号，然后写出一个 `evidence.config.js`。从此每次录制都从已登录、
环境可用的状态开始，不会再来问你。

想改什么，说一声就行——“录慢一点”“字幕用日文”“只留最新的一次”——它会替你改那个文件。

## 它能做什么

| 你想要 | 命令 |
|---|---|
| 刚改完的页面的证据 | `/webapp-evidence:recording` |
| MR/PR 的证据，自己从 diff 判断录什么 | `/webapp-evidence:recording <MR/PR 链接>` |
| 按描述录一个页面，不需要仓库 | `/webapp-evidence:recording Page: <url>` 加上步骤 |
| 录制转成 gif 放进 README，或转 webm 放到网页 | `/webapp-evidence:recording -f gif` · `-f webm` |
| 不看视频也知道里面发生了什么 | `/webapp-evidence:vision <mp4 文件>` |
| 给项目配一次，以后录制都已登录 | `/webapp-evidence:recording set up the evidence config for this project` |
| 再录一遍——数据变了，视频坏了 | 说一声即可；命令在 runbook 里，旧的录制也会保留 |
| 录慢一点，字幕换种语言 | 说出来，它会去改 `evidence.config.js` |

默认是 mp4，因为它在 merge request、issue 和各种聊天工具里都能直接播放，而且是三种格式里最小
的。同一段录制的 gif 会大好几倍，所以转换只是建议，不会自作主张。

`vision` 存在的原因是智能体看不了视频。它把视频拼成图片网格——每隔几秒一帧，每帧标着
`mm:ss`——然后当图片来读，所以结论是"00:14 处标题压住了表格"：一个你能回看核对、也能和 runbook
对上的时刻。它能发现没人想到要截图的东西，比如过渡途中错位的布局。

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
