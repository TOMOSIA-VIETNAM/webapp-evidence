// English is the source of truth: every key added here is added to vi.ts, ja.ts and zh.ts in the
// same change. `pnpm check` fails on any key that exists in one language only.
// Technical strings (command names, code, file names, PASS/FAIL marks) stay English everywhere.
export const en = {
  'meta.title': 'webapp-evidence — describe the flow, get the recording',
  'meta.description':
    'An open-source skill for AI coding agents that records your web app and returns a video, screenshots and a runbook — evidence for UAT, hand-offs, bug reports and reviews.',

  'nav.label': 'Main',
  'nav.uat': 'UAT',
  'nav.howItWorks': 'How it works',
  'nav.features': 'Features',
  'nav.install': 'Install',
  'nav.github': 'GitHub',
  'nav.skipToContent': 'Skip to content',
  'nav.languageMenu': 'Choose language',
  'lang.en': 'English',
  'lang.vi': 'Tiếng Việt',
  'lang.ja': '日本語',
  'lang.zh': '简体中文',
  'lang.en.short': 'EN',
  'lang.vi.short': 'VI',
  'lang.ja.short': 'JA',
  'lang.zh.short': 'ZH',

  'action.copy': 'Copy',
  'action.copied': 'Copied',
  'action.scrollTop': 'Back to top',

  'hero.badge': 'Open source · MIT',
  'hero.headline': 'Describe the flow, get the recording.',
  'hero.lead':
    'One command records your web app and hands back a video, screenshots of the main steps and a runbook — the evidence UAT, a hand-off, a bug report or a review asks for, without half an hour of screen capture.',
  'hero.cta.start': 'Install',
  'hero.cta.github': 'View on GitHub',
  'hero.command.label': 'Then type this in your agent',
  'hero.platforms': 'Works in',
  'hero.mark.alt': 'The webapp-evidence firefly, its lantern lit like a record light',
  'hero.output.video': 'The operation video',
  'hero.output.shots': 'Screenshots of the main steps',
  'hero.output.runbook': 'The runbook',

  'uat.eyebrow': 'Built for UAT',
  'uat.heading': 'Acceptance criteria in, signed-off evidence out',
  'uat.lead':
    'AI made the change fast. Proving it works did not get faster: acceptance testing still means someone clicking through every criterion and recording it by hand. Write the criteria as a flow instead — one take comes back with each of them on camera, timestamped, and every page error written down.',
  'uat.step1.title': 'Write the criteria as a flow',
  'uat.step1.body':
    'Numbered steps in plain words, in whatever language the team works in. An MR or PR link works too — the agent reads what changed and proposes the flow.',
  'uat.step2.title': 'One take runs every step',
  'uat.step2.body':
    'Chrome is driven by a visible pointer at a pace a viewer can follow. A step that calls an endpoint asserts its status, so a wrong answer stops the take instead of shipping as evidence.',
  'uat.step3.title': 'The runbook is the report',
  'uat.step3.body':
    'Every step with its time in the video, the commands run and their exit codes, and every console error and failed request seen while recording.',
  'uat.step4.title': 'Sign off, or send it back',
  'uat.step4.body':
    'The reviewer checks each criterion against a timestamp instead of re-running the flow. After a fix, “record that again” makes a new take and keeps the old one beside it.',

  'uat.report.title': 'This page, read as a UAT report',
  'uat.report.lead': 'The video under How it works is this page, recorded by the skill it describes. Pick a criterion to see the runbook lines that prove it.',
  'uat.report.criteria': 'Acceptance criteria',
  'uat.report.runbook': 'Runbook',
  'uat.report.ac1': 'The site reads in all four languages',
  'uat.report.ac2': 'The command that starts a recording can be copied from the hero',
  'uat.report.ac3': 'Each acceptance criterion picks out the runbook lines that prove it',
  'uat.report.ac4': 'Every agent has its own install panel',
  'uat.report.ac5': 'The page serves its title, description and social card',
  'uat.report.ac6': 'No console error or failed request during the take',
  'uat.report.source': 'Lines copied unedited from the runbook of that take.',
  'uat.report.reset': 'Show every line',

  'how.eyebrow': 'How it works',
  'how.heading': 'Three steps, inside the agent you already use',
  'how.step1.title': 'Install the skill',
  'how.step1.body':
    'One command for Claude Code, Cursor, Codex, Gemini CLI or Antigravity. Recording needs Chrome, ffmpeg and Node; the agent names anything missing and offers to install it.',
  'how.step2.title': 'Describe the flow',
  'how.step2.body':
    'The page and the steps, or nothing at all: right after a change, the agent already knows which screen you were working on.',
  'how.step3.title': 'Get the evidence',
  'how.step3.body':
    'An mp4, numbered screenshots and a runbook, on your disk. Attaching them to a ticket, an MR or a report is yours to do — nothing is committed.',
  'how.demo.caption': 'This page, recorded by webapp-evidence itself — the take the UAT report above quotes.',
  'how.demo.alt': 'A take of this page: the language menu, the firefly under the pointer, the command copied, each acceptance criterion picked in the UAT report, the sections read down to the install tabs, and the SEO meta read in the terminal panel.',

  'proof.eyebrow': 'Full-stack evidence',
  'proof.heading': 'One take proves the screen, the endpoint and the database',
  'proof.lead':
    'A screen recording shows half of a full-stack change. The same take can call the API with the session the browser already holds, and read the row it wrote back from the database.',
  'proof.request.label': 'What you type',
  'proof.screen.title': 'The screen',
  'proof.screen.body': 'The form is filled in and submitted by a visible pointer, at the pace a viewer reads at.',
  'proof.endpoint.title': 'The endpoint',
  'proof.endpoint.body':
    'A terminal panel opens over the page and curl runs there with the browser’s cookies. The step asserts the status, on camera.',
  'proof.database.title': 'The database',
  'proof.database.body':
    'psql, mysql, a rake task — whatever you would run yourself, with the new row in frame beside the screen that created it.',
  'proof.secrets':
    'Cookies and tokens reach curl through a file and are masked everywhere: video, screenshots, runbook.',

  'vision.eyebrow': 'Checking the take',
  'vision.heading': 'An agent cannot watch a video. vision lets it read one.',
  'vision.lead':
    'It tiles a recording into contact sheets — a frame every couple of seconds, each stamped mm:ss — so a finding comes back as “the header overlaps the table at 00:14”, a time you can check against the runbook.',
  'vision.sheet': 'Contact sheet',
  'vision.sheet.alt': 'Contact sheet of this page’s take: a grid of timestamped frames',

  'features.eyebrow': 'Features',
  'features.heading': 'Evidence a reviewer can trust',
  'features.human.title': 'It reads like a person did it',
  'features.human.body':
    'The pointer travels, the typing is uneven, a scroll comes to rest on what it travelled to. Nothing jumps.',
  'features.runbook.title': 'A runbook, not just a file',
  'features.runbook.body':
    'The timeline, the captions, the commands run, the page errors seen, and the command that produces the same take again.',
  'features.secrets.title': 'Secrets stay out',
  'features.secrets.body': 'Blur, black out or cut a stretch, in the video and the screenshots alike.',
  'features.local.title': 'Nothing leaves your machine',
  'features.local.body':
    'No service and no bot account. It runs inside the agent CLI you already have, against the site you name and nothing else.',
  'features.native.title': 'Dialogs, when they are the point',
  'features.native.body':
    'Native dropdowns and confirm dialogs are captioned by default. When one is the evidence, --screen records the browser window instead.',
  'features.language.title': 'No syntax to learn',
  'features.language.body':
    'Ask in any language and the agent answers in it. Captions in another language, a slower take — remembered per project.',

  'install.eyebrow': 'Install',
  'install.heading': 'Pick the agent you use',
  'install.lead': 'One skill, five platforms. The command to run it depends on where you type it.',
  'install.column.install': 'Install',
  'install.column.use': 'Record',
  'install.column.vision': 'Read a video back',
  'install.requirements':
    'Recording needs Chrome, ffmpeg and Node. The one-liner asks which platform you use and says where things landed.',

  'footer.releases': 'Releases',
  'footer.issues': 'Issues',
  'footer.license': 'License',
  'footer.by': 'Made by',
  'footer.licenseLine': 'Open source under the MIT license',
} as const

export type Dictionary = Record<keyof typeof en, string>
