import type { Dictionary } from './en'

export const zh: Dictionary = {
  'meta.title': 'webapp-evidence — 描述流程，拿到录屏',
  'meta.description':
    '面向 AI 编程智能体的开源 skill：录制你的 Web 应用，返回视频、截图和运行手册 —— 用于 UAT、交接、缺陷报告和评审的证据。',

  'nav.label': '主导航',
  'nav.uat': 'UAT',
  'nav.howItWorks': '工作方式',
  'nav.features': '功能',
  'nav.install': '安装',
  'nav.github': 'GitHub',
  'nav.skipToContent': '跳到正文',
  'nav.languageMenu': '选择语言',
  'lang.en': 'English',
  'lang.vi': 'Tiếng Việt',
  'lang.ja': '日本語',
  'lang.zh': '简体中文',
  'lang.en.short': 'EN',
  'lang.vi.short': 'VI',
  'lang.ja.short': 'JA',
  'lang.zh.short': 'ZH',

  'action.copy': '复制',
  'action.copied': '已复制',
  'action.scrollTop': '回到顶部',

  'hero.badge': '开源 · MIT',
  'hero.headline': '描述流程，拿到录屏。',
  'hero.lead':
    '一条命令录下你的 Web 应用，交回视频、关键步骤的截图和运行手册 —— 正是 UAT、交接、缺陷报告或评审所要的证据，不用再花半小时手动录屏。',
  'hero.cta.start': '安装',
  'hero.cta.github': '在 GitHub 查看',
  'hero.command.label': '然后在智能体里输入',
  'hero.platforms': '支持',
  'hero.mark.alt': 'webapp-evidence 的萤火虫，尾部的光像录制指示灯一样亮着',
  'hero.output.video': '操作视频',
  'hero.output.shots': '关键步骤截图',
  'hero.output.runbook': '运行手册',

  'uat.eyebrow': '为 UAT 而生',
  'uat.heading': '输入验收标准，输出可签字的证据',
  'uat.lead':
    'AI 让改动变快了，证明它能用却没有变快：验收测试依然是有人逐条点击每个标准、再手动录下来。改为把标准写成一个流程 —— 一次录制就能交回每条标准的画面，带时间戳，页面上的每个错误也都记录在案。',
  'uat.step1.title': '把标准写成流程',
  'uat.step1.body':
    '用平常的话写编号步骤，用团队习惯的语言。给一个 MR 或 PR 链接也行 —— 智能体会读改动并推导出流程。',
  'uat.step2.title': '一次录制跑完所有步骤',
  'uat.step2.body':
    '用可见的指针驱动 Chrome，速度让观看者跟得上。调用接口的步骤会断言状态码，错误的响应会让录制停下，而不是被当作证据交出去。',
  'uat.step3.title': '运行手册就是报告',
  'uat.step3.body':
    '每一步在视频里的时间、执行过的命令及其退出码，以及录制期间出现的每个控制台错误和失败请求。',
  'uat.step4.title': '签字，或者打回',
  'uat.step4.body':
    '评审者按时间戳逐条核对标准，不必重跑流程。修复之后，一句“再录一遍”就生成新的录制，旧的保留在旁边。',

  'uat.report.title': '一次真实的录制，当作 UAT 报告来读',
  'uat.report.lead': 'README 的演示录制了 open-pr 的落地页。选一条标准，看证明它的运行手册行。',
  'uat.report.criteria': '验收标准',
  'uat.report.runbook': '运行手册',
  'uat.report.ac1': '可以从首屏复制安装命令',
  'uat.report.ac2': '评审循环的每一步都能手动选中',
  'uat.report.ac3': '页面返回 SEO 的 title 和 description',
  'uat.report.ac4': '录制期间没有控制台错误或失败请求',
  'uat.report.source': '以上各行原样引自 docs/demo/record.sh 生成的运行手册。',
  'uat.report.reset': '显示所有行',

  'how.eyebrow': '工作方式',
  'how.heading': '三步，就在你正在用的智能体里',
  'how.step1.title': '安装 skill',
  'how.step1.body':
    'Claude Code、Cursor、Codex、Gemini CLI 或 Antigravity，一条命令即可。录制需要 Chrome、ffmpeg 和 Node；缺什么，智能体会指出并提出帮你安装。',
  'how.step2.title': '描述流程',
  'how.step2.body': '写出页面和步骤，或者什么都不写：刚改完代码时，智能体已经知道你在做哪个页面。',
  'how.step3.title': '拿到证据',
  'how.step3.body':
    '一个 mp4、编号截图和运行手册，都在你的磁盘上。附到工单、MR 或报告里由你决定 —— 不会提交任何东西。',
  'how.demo.caption': '本仓库运行器的真实输出，浏览 open-pr.vercel.app。',
  'how.demo.alt':
    '落地页导览：复制安装命令、按钮给出确认，然后向下阅读“工作方式”，逐步点击评审轮次的讲解，最后是功能卡片。',

  'proof.eyebrow': '全栈证据',
  'proof.heading': '一次录制，证明页面、接口和数据库',
  'proof.lead':
    '录屏只展示了全栈改动的一半。同一次录制可以用浏览器已持有的会话调用 API，再从数据库读回它写入的那一行。',
  'proof.request.label': '你输入的内容',
  'proof.screen.title': '页面',
  'proof.screen.body': '表单由可见的指针填写并提交，速度让观看者读得过来。',
  'proof.endpoint.title': '接口',
  'proof.endpoint.body': '页面上方打开一个终端面板，curl 带着浏览器的 Cookie 在里面运行。该步骤断言状态码，全程在画面中。',
  'proof.database.title': '数据库',
  'proof.database.body': 'psql、mysql、一个 rake 任务 —— 你自己会跑的任何命令，新写入的行就出现在创建它的页面旁边。',
  'proof.secrets': 'Cookie 和令牌通过文件传给 curl，并在所有地方被遮盖：视频、截图、运行手册。',

  'vision.eyebrow': '检查录制',
  'vision.heading': '智能体看不了视频。vision 让它能读。',
  'vision.lead':
    '它把录制拼成联系表 —— 每隔几秒一帧，每帧标注 mm:ss —— 于是结论会写成“00:14 处页头压住了表格”，一个可以对照运行手册核实的时间点。',
  'vision.sheet': '联系表',
  'vision.sheet.alt': 'README 演示的联系表：来自录制的带时间戳的帧网格',

  'features.eyebrow': '功能',
  'features.heading': '评审者信得过的证据',
  'features.human.title': '看起来像真人在操作',
  'features.human.body': '指针会移动，打字有快有慢，滚动会停在它要去的地方。没有任何跳变。',
  'features.runbook.title': '是运行手册，而不只是文件',
  'features.runbook.body': '时间线、字幕、执行过的命令、遇到的页面错误，以及重现同一次录制的命令。',
  'features.secrets.title': '机密不入镜',
  'features.secrets.body': '模糊、涂黑或剪掉一段，视频和截图一视同仁。',
  'features.local.title': '一切都不离开你的机器',
  'features.local.body': '没有服务，没有机器人账号。它在你已有的智能体 CLI 里运行，只针对你指定的站点。',
  'features.native.title': '当对话框本身就是证据',
  'features.native.body':
    '原生下拉框和 confirm 对话框默认以字幕记录。当它本身就是证据时，--screen 会改为录制整个浏览器窗口。',
  'features.language.title': '没有语法要学',
  'features.language.body': '用任何语言提问，智能体就用那种语言回答。另一种语言的字幕、更慢的录制 —— 按项目记住。',

  'install.eyebrow': '安装',
  'install.heading': '选择你用的智能体',
  'install.lead': '一个 skill，五个平台。运行它的命令取决于你在哪里输入。',
  'install.column.install': '安装',
  'install.column.use': '录制',
  'install.column.vision': '读回一个视频',
  'install.requirements': '录制需要 Chrome、ffmpeg 和 Node。一行安装命令会询问你用哪个平台，并告诉你装到了哪里。',

  'footer.releases': '版本发布',
  'footer.issues': 'Issues',
  'footer.license': '许可证',
  'footer.by': '出品',
  'footer.licenseLine': '以 MIT 许可证开源',
}
