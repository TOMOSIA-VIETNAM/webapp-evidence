<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./docs/images/logo/logo-lockup-dark.svg">
    <img src="./docs/images/logo/logo-lockup.svg" alt="webapp-evidence" width="420">
  </picture>
</p>

<p align="center">
  <strong>写下操作步骤，拿到录像。</strong><br>
  <sub>一条命令录下你的 Web 应用，交给你一段视频、一组截图和一份 runbook——用于 UAT、交接、缺陷报告和评审。</sub><br>
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

总会有人要亲眼看到应用真的能跑：UAT 签字、交接给另一个团队或供应商、一份缺陷报告、一场演示、
一次代码评审。可是自己录，花掉半小时，效果还是不好。截图总是慢了一拍。鼠标在屏幕上乱跳。下拉
菜单在画面里不会打开，没人看得出你选了什么。

那就把操作步骤讲给你的编码代理。它操作 Chrome，然后交给你一段干净的视频、停在关键时刻的截图，
以及一份能把这次录制重现出来的 runbook。

## 你只要这样说

```
/webapp-evidence:recording Page: https://www.saucedemo.com
Flow:
1. Log in using standard_user / secret_sauce
2. Change the sort dropdown to "Price (low to high)"
3. Add "Sauce Labs Backpack" to the cart, then open the cart
4. Checkout, fill First Name / Last Name / Zip as Minh / Tang / 700000
5. Continue, then Finish, and stop at the "Thank you for your order!" screen
```

## 你会拿回这些

<p align="center">
  <img src="./docs/demo/saucedemo.gif" width="820" alt="Swag Labs 结账流程的录屏：光标登录，按价格排序商品列表（下拉菜单由操作系统绘制、录不进画面，所以底部字幕说明选了哪一项），把背包加入购物车，填写结账表单，完成订单。">
</p>

八张截图，都停在关键的那一刻。还有一份 runbook——拿到的人读一遍就够，不必看视频：

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

最后那一段是额外的收获。录制的同时，它也在看控制台和网络——所以这里读的人会知道页面正在返回
401。截图不会告诉你这件事，而且本来也没人在找。

runbook 里还保留着生成这次录制的那条命令。数据变了、视频坏了、对方想看慢一点？再说一次就好。
旧的录制会保留为 `v1`、`v2`、……，不会被覆盖——因为已经发出去的录制，是唯一无法重新生成的
东西。

## 为什么这段视频看得下去

- **光标可见，动得像一只手。** 走曲线，起步快，收得慢，目标远时会冲过头再修回来。每次点击都留下
  一圈波纹。
- **节奏跟着画面走。** 只是跳转的点击走得快；结果出现的时候，会停到足够读完。
- **画面装不下的，用字幕说出来。** `<select>` 菜单和文件选择框由操作系统绘制，永远进不了页面
  录制，所以底部字幕会说明选了什么。快捷键会在它作用的元素旁边显示按键提示（`⌘ + C`）。
- **页面加载的等待被剪掉了**，视频从真正开始干活的地方开始。

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

它会问你用哪个平台，然后告诉你东西都放在哪里。录制需要机器上有 Chrome、ffmpeg 和 Node——缺哪个，
代理会说清楚，并提出帮你装上。

这条一行命令装的是最新的发布版本；还没有发布版本时装 `main`。想选别的就用 `--ref`，这个选择会被
记住，以后更新仍然停在你指定的位置：

```bash
curl -fsSL … /install.sh | bash -s -- --ref main       # a branch, to try a change before it ships
curl -fsSL … /install.sh | bash -s -- --ref v1.2.0     # a release, to pin a team to one version
curl -fsSL … /install.sh | bash -s -- --ref latest     # back to following releases
```

更新用 `~/.webapp-evidence/scripts/install-local.sh --update`，卸载用 `--uninstall --all`。
一点要注意：`install.sh` 始终从默认分支下载，所以安装脚本自身的修改，要合并进去之后才会到你手上。

## 三种叫它的方式

| platform | how you call it |
|---|---|
| Claude Code | `/webapp-evidence:recording` |
| Cursor, Gemini CLI, Antigravity | `/webapp-evidence-recording` |
| Codex | `$webapp-evidence-recording` |

**你刚做完一个任务或修完一个缺陷。** 哪个界面变了，代理已经知道，后面什么都不用写：

```
/webapp-evidence:recording
```

**你手上只有一个链接。** 它会读 MR/PR 的描述和 diff，自己判断该录什么：

```
/webapp-evidence:recording https://gitlab.example.com/group/admin/-/merge_requests/1783
```

**你不写代码。** 像上面的例子那样，给出页面、说清要看到什么。不需要仓库，不需要配置，什么都不用
搭。步骤用你正在想的那种语言写就行；代理用同一种语言回你。

也没有语法要记——说“给我刚修好的那个界面的证据”，结果是一样的。

## 对准你的项目，只需一次

```
/webapp-evidence:recording set up the evidence config for this project
```

它会找到登录界面和一个开发账号，然后写出一个 `evidence.config.js`。从此每次录制都从已登录、
环境可用的状态开始，不会再来问你。

想改什么，说一声就行——“录慢一点”“字幕用日文”“只留最新的一次”——它会替你改那个文件。

## 值得知道的限制

它录的是页面，不是你的屏幕。所以操作系统画的东西都在画面之外：`<select>` 下拉菜单、文件选择框、
`confirm`/`alert` 对话框。这些时刻会配一条字幕说明选了什么，再加一张之后状态的截图。用 JS 做的
模态框、日期选择器和下拉菜单都能正常录进去。

录制只针对本地开发环境或你指定的站点——不碰预发布，也不碰生产。

视频和截图不进 Git。贴到哪里——工单、MR/PR、报告——由你自己决定。

---

上面那段录制是本仓库 runner 的真实输出：`docs/demo/record.sh` 从
`docs/demo/saucedemo-steps.js` 生成它。想改这个技能本身？见
**[CONTRIBUTING.md](./CONTRIBUTING.md)**。
