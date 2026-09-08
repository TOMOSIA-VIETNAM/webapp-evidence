<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./docs/images/logo/logo-lockup-dark.svg">
    <img src="./docs/images/logo/logo-lockup.svg" alt="webapp-evidence" width="420">
  </picture>
</p>

<p align="center">
  <strong>证据自己会录。</strong><br>
  <sub>说一次就行。拿到一段视频、一组截图，和一份可以直接交给评审者的 runbook。</sub><br>
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

给 merge request 附证据，通常就是一张时机不对的截图，或者一段鼠标瞬移、下拉菜单始终没打开、谁也看不清
到底按了哪个按钮的录屏。于是大多数改动干脆什么证据都不附，评审只能靠信任放行。

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
  <img src="./docs/demo/saucedemo.gif" width="820" alt="一段 Swag Labs 结账流程的录制：光标完成登录，把商品列表按价格排序 —— 底部有一行字幕说明选了哪一项，因为下拉菜单由操作系统绘制、录不进画面 —— 接着把一个背包加入购物车，填写结账表单，最后完成下单。">
</p>

外加八张停在关键时刻的截图，以及一份 runbook —— 评审者什么都不用看，读它就够了：

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

最后那一段是谁都没想到的。录制时 runner 会一直盯着 console 和网络请求，于是评审者能知道页面正在报 401
—— 这是任何截图都拍不出来、也根本没人会去找的东西。

runbook 里还带着能原样复现这次录制的命令。数据变了、视频废了、评审者希望放慢一点：再说一次就行。上一次
的录制会保存成 `v1`、`v2`……而不是被覆盖，因为已经随 MR 发出去的证据，恰恰是唯一没法重新生成的东西。

## 为什么值得评审者花时间看

- **光标看得见，而且动得像真人的手**——走弧线，起步快、刹车慢，目标较远时会先冲过头再修正回来。每次点击
  都留下一圈涟漪。
- **节奏跟着画面走。** 只负责跳转的点击干脆利落；结果一出现，就停留到足够读完为止。
- **画面装不下的东西，用嘴说出来。** `<select>` 菜单和文件选择器由操作系统绘制，永远不会进入页面录制
  —— 所以底部会有一行字幕说明选了什么。键盘快捷键则会在对应元素旁弹出按键提示（`⌘ + C`）。
- **页面加载的等待被剪掉了**，视频从真正开始干活的地方起步。

## 安装

**Claude Code**

```bash
claude plugin marketplace add TOMOSIA-VIETNAM/webapp-evidence
claude plugin install webapp-evidence@webapp-evidence
```

**Cursor、Codex、Gemini CLI、Antigravity**

```bash
curl -fsSL https://raw.githubusercontent.com/TOMOSIA-VIETNAM/webapp-evidence/main/install.sh | bash
```

它会问你要装到哪个平台，并告诉你东西放在了哪里。录制需要本机有 Chrome、ffmpeg 和 Node —— 缺哪个，
agent 都会直接说明，并主动帮你装上。

这条一行命令默认安装最新的 release；还没有 release 时则装 `main`。`--ref` 可以指定别的版本，而且会被
记住，之后更新也仍停在你指定的位置：

```bash
curl -fsSL … /install.sh | bash -s -- --ref main       # a branch, to try a change before it ships
curl -fsSL … /install.sh | bash -s -- --ref v1.2.0     # a release, to pin a team to one version
curl -fsSL … /install.sh | bash -s -- --ref latest     # back to following releases
```

更新用 `~/.webapp-evidence/scripts/install-local.sh --update`，卸载用 `--uninstall --all`。
注意 `install.sh` 永远从默认分支拉取，所以安装脚本自身的改动，要等合并进默认分支之后才会传到你这边。

## 怎么调用

| 平台 | 调用方式 |
|---|---|
| Claude Code | `/webapp-evidence:recording` |
| Cursor、Gemini CLI、Antigravity | `/webapp-evidence-recording` |
| Codex | `$webapp-evidence-recording` |

**刚做完一个任务或修完一个 bug。** agent 已经知道是哪个页面变了，所以后面什么都不用写：

```
/webapp-evidence:recording
```

**你手上只有一个链接。** 它会去读这个 MR/PR 的描述和 diff，自己判断该录什么：

```
/webapp-evidence:recording https://gitlab.example.com/group/admin/-/merge_requests/1783
```

**你不写代码。** 像上面的例子那样，给出页面地址，说清楚要展示什么就行。不需要仓库，不需要配置，没有任何
东西要搭。步骤用你习惯的语言写；agent 会用同一种语言回你。

也没有语法需要记 —— 一句「给我刚修好的那个页面录份证据」，效果完全一样。

## 在项目里使用

对准一个项目跑一次，它就学会了怎么进去：

```
/webapp-evidence:recording set up the evidence config for this project
```

它会探查登录页，找到一个开发账号，然后写出一份 `evidence.config.js`。从此每次录制都在一个能用的环境里
以登录状态开始，不必再交代一遍。

想改什么直接说 ——「录慢一点」「字幕用日语」「只保留最新的一次录制」—— 它会替你改那个文件。

## 值得知道的限制

视频录的是页面，不是你的屏幕，所以凡是操作系统画出来的东西都进不了画面：`<select>` 下拉框、文件选择器、
`confirm`/`alert` 对话框。这些时刻会配一行字幕说明选了什么，再加一张事后状态的截图。用 JS 实现的弹窗、
日期选择器和下拉菜单则能正常录到。

录制只跑在本地开发环境或你指定的站点上 —— 绝不碰 staging，绝不碰生产环境。

视频和截图不会进 Git。附到 MR/PR 上这一步，由你自己来。

---

上面那段录制是本仓库 runner 的真实输出：`docs/demo/record.sh` 基于 `docs/demo/saucedemo-steps.js`
生成它。想改 skill 本身？请看 **[CONTRIBUTING.md](./CONTRIBUTING.md)**。
