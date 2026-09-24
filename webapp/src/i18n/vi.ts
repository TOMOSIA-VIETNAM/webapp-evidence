import type { Dictionary } from './en'

export const vi: Dictionary = {
  'meta.title': 'webapp-evidence — mô tả luồng, nhận bản ghi',
  'meta.description':
    'Skill mã nguồn mở cho AI coding agent: ghi lại web app của bạn và trả về video, ảnh chụp màn hình và runbook — bằng chứng cho UAT, bàn giao, báo lỗi và review.',

  'nav.label': 'Chính',
  'nav.uat': 'UAT',
  'nav.howItWorks': 'Cách hoạt động',
  'nav.features': 'Tính năng',
  'nav.install': 'Cài đặt',
  'nav.github': 'GitHub',
  'nav.skipToContent': 'Bỏ qua, tới nội dung',
  'nav.languageMenu': 'Chọn ngôn ngữ',
  'lang.en': 'English',
  'lang.vi': 'Tiếng Việt',
  'lang.ja': '日本語',
  'lang.zh': '简体中文',
  'lang.en.short': 'EN',
  'lang.vi.short': 'VI',
  'lang.ja.short': 'JA',
  'lang.zh.short': 'ZH',

  'action.copy': 'Sao chép',
  'action.copied': 'Đã chép',
  'action.scrollTop': 'Lên đầu trang',

  'hero.badge': 'Mã nguồn mở · MIT',
  'hero.headline': 'Mô tả luồng, nhận bản ghi.',
  'hero.lead':
    'Một lệnh ghi lại web app của bạn và trả về video, ảnh chụp các bước chính và runbook — đúng thứ bằng chứng mà UAT, bàn giao, báo lỗi hay review cần, không phải mất nửa tiếng quay màn hình.',
  'hero.cta.start': 'Cài đặt',
  'hero.cta.github': 'Xem trên GitHub',
  'hero.command.label': 'Rồi gõ lệnh này trong agent',
  'hero.platforms': 'Chạy trên',
  'hero.mark.alt': 'Con đom đóm của webapp-evidence, đèn bụng sáng như đèn ghi hình',
  'hero.output.video': 'Video thao tác',
  'hero.output.shots': 'Ảnh chụp các bước chính',
  'hero.output.runbook': 'Runbook',

  'uat.eyebrow': 'Sinh ra cho UAT',
  'uat.heading': 'Đưa vào tiêu chí nghiệm thu, nhận về bằng chứng để ký duyệt',
  'uat.lead':
    'AI làm thay đổi nhanh. Chứng minh nó chạy đúng thì không nhanh hơn: kiểm thử nghiệm thu vẫn là một người bấm qua từng tiêu chí rồi tự quay lại. Hãy viết tiêu chí thành một luồng — một lần quay trả về đủ từng tiêu chí trên video, có mốc thời gian, và mọi lỗi của trang đều được ghi lại.',
  'uat.step1.title': 'Viết tiêu chí thành một luồng',
  'uat.step1.body':
    'Các bước đánh số bằng lời thường, bằng ngôn ngữ team đang dùng. Đưa link MR hoặc PR cũng được — agent đọc phần thay đổi và tự suy ra luồng.',
  'uat.step2.title': 'Một lần quay chạy mọi bước',
  'uat.step2.body':
    'Chrome được điều khiển bằng con trỏ hiện rõ, với tốc độ người xem theo kịp. Bước gọi endpoint sẽ kiểm tra status, nên câu trả lời sai dừng lần quay thay vì lọt vào làm bằng chứng.',
  'uat.step3.title': 'Runbook chính là báo cáo',
  'uat.step3.body':
    'Mỗi bước kèm thời điểm trong video, các lệnh đã chạy cùng exit code, và mọi lỗi console hay request thất bại xuất hiện trong lúc ghi.',
  'uat.step4.title': 'Ký duyệt, hoặc trả lại',
  'uat.step4.body':
    'Người duyệt đối chiếu từng tiêu chí với một mốc thời gian thay vì tự chạy lại luồng. Sau khi sửa, “quay lại lần nữa” tạo lần quay mới và giữ lần cũ bên cạnh.',

  'uat.report.title': 'Chính trang này, đọc như báo cáo UAT',
  'uat.report.lead': 'Video ở phần Cách hoạt động là chính trang này, do skill mà nó giới thiệu quay lại. Chọn một tiêu chí để xem những dòng runbook chứng minh nó.',
  'uat.report.criteria': 'Tiêu chí nghiệm thu',
  'uat.report.runbook': 'Runbook',
  'uat.report.ac1': 'Trang hiển thị đủ bốn ngôn ngữ',
  'uat.report.ac2': 'Sao chép được lệnh bắt đầu ghi hình ngay ở hero',
  'uat.report.ac3': 'Mỗi tiêu chí nghiệm thu chỉ ra đúng những dòng runbook chứng minh nó',
  'uat.report.ac4': 'Mỗi agent có panel cài đặt riêng',
  'uat.report.ac5': 'Trang trả về title, description và thẻ chia sẻ mạng xã hội',
  'uat.report.ac6': 'Không có lỗi console hay request thất bại trong lần quay',
  'uat.report.source': 'Các dòng được chép nguyên văn từ runbook của lần quay đó.',
  'uat.report.reset': 'Hiện mọi dòng',

  'how.eyebrow': 'Cách hoạt động',
  'how.heading': 'Ba bước, ngay trong agent bạn đang dùng',
  'how.step1.title': 'Cài skill',
  'how.step1.body':
    'Một lệnh cho Claude Code, Cursor, Codex, Gemini CLI hoặc Antigravity. Ghi hình cần Chrome, ffmpeg và Node; thiếu gì agent sẽ nói và đề nghị cài giúp.',
  'how.step2.title': 'Mô tả luồng',
  'how.step2.body':
    'Trang và các bước, hoặc không cần gì: ngay sau khi sửa, agent đã biết bạn vừa làm màn hình nào.',
  'how.step3.title': 'Nhận bằng chứng',
  'how.step3.body':
    'Một file mp4, ảnh chụp đánh số và runbook, nằm trên máy bạn. Đính kèm vào ticket, MR hay báo cáo là việc của bạn — không có gì bị commit.',
  'how.demo.caption': 'Chính trang này, do webapp-evidence tự quay — lần quay mà báo cáo UAT phía trên trích dẫn.',
  'how.demo.alt': 'Một lần quay trang này: menu ngôn ngữ, con đom đóm dưới con trỏ, lệnh được sao chép, từng tiêu chí trong báo cáo UAT được chọn, các phần được đọc xuống tới tab cài đặt, và thẻ SEO được đọc trong panel terminal.',

  'proof.eyebrow': 'Bằng chứng full-stack',
  'proof.heading': 'Một lần quay chứng minh màn hình, endpoint và database',
  'proof.lead':
    'Quay màn hình chỉ cho thấy một nửa thay đổi full-stack. Cùng lần quay đó có thể gọi API bằng session trình duyệt đang giữ, và đọc lại từ database dòng mà nó vừa ghi.',
  'proof.request.label': 'Bạn gõ',
  'proof.screen.title': 'Màn hình',
  'proof.screen.body': 'Form được điền và gửi bằng con trỏ hiện rõ, với tốc độ người xem đọc kịp.',
  'proof.endpoint.title': 'Endpoint',
  'proof.endpoint.body':
    'Một panel terminal mở đè lên trang và curl chạy ở đó bằng cookie của trình duyệt. Bước này kiểm tra status, ngay trên video.',
  'proof.database.title': 'Database',
  'proof.database.body':
    'psql, mysql, một rake task — lệnh gì bạn tự chạy cũng được, với dòng mới nằm trong khung hình cạnh màn hình đã tạo ra nó.',
  'proof.secrets':
    'Cookie và token đến tay curl qua một file và được che ở mọi nơi: video, ảnh chụp, runbook.',

  'vision.eyebrow': 'Kiểm lại lần quay',
  'vision.heading': 'Agent không xem được video. vision giúp nó đọc được.',
  'vision.lead':
    'Nó cắt bản ghi thành các contact sheet — vài giây một khung hình, mỗi khung đóng dấu mm:ss — nên phát hiện trả về dạng “header đè lên bảng ở 00:14”, một mốc bạn đối chiếu được với runbook.',
  'vision.sheet': 'Contact sheet',
  'vision.viewer.previous': 'Sheet trước',
  'vision.viewer.next': 'Sheet sau',
  'vision.viewer.close': 'Đóng',
  'vision.sheet.alt': 'Contact sheet của lần quay trang này: lưới các khung hình có mốc thời gian',

  'features.eyebrow': 'Tính năng',
  'features.heading': 'Bằng chứng người duyệt tin được',
  'features.human.title': 'Trông như người thật thao tác',
  'features.human.body':
    'Con trỏ di chuyển, gõ phím không đều, cuộn trang dừng lại đúng chỗ nó hướng tới. Không có gì nhảy cóc.',
  'features.runbook.title': 'Runbook, không chỉ là một file',
  'features.runbook.body':
    'Dòng thời gian, phụ đề, các lệnh đã chạy, lỗi trang gặp phải, và lệnh để quay lại y hệt.',
  'features.secrets.title': 'Bí mật không lọt ra',
  'features.secrets.body': 'Làm mờ, bôi đen hoặc cắt bỏ một đoạn, trong video lẫn ảnh chụp.',
  'features.local.title': 'Không gì rời khỏi máy bạn',
  'features.local.body':
    'Không có dịch vụ, không có tài khoản bot. Nó chạy trong agent CLI bạn đang có, trên đúng site bạn chỉ định và không gì khác.',
  'features.native.title': 'Hộp thoại, khi chính nó là bằng chứng',
  'features.native.body':
    'Dropdown gốc và hộp thoại confirm mặc định được ghi chú bằng phụ đề. Khi chính nó là bằng chứng, --screen quay cả cửa sổ trình duyệt.',
  'features.language.title': 'Không có cú pháp phải học',
  'features.language.body':
    'Hỏi bằng ngôn ngữ nào, agent trả lời bằng ngôn ngữ đó. Phụ đề tiếng khác, quay chậm hơn — được nhớ theo từng project.',

  'install.eyebrow': 'Cài đặt',
  'install.heading': 'Chọn agent bạn dùng',
  'install.lead': 'Một skill, năm nền tảng. Lệnh để chạy tuỳ vào nơi bạn gõ.',
  'install.column.install': 'Cài đặt',
  'install.column.use': 'Ghi hình',
  'install.column.vision': 'Đọc lại một video',
  'install.requirements':
    'Ghi hình cần Chrome, ffmpeg và Node. Lệnh một dòng sẽ hỏi bạn dùng nền tảng nào và cho biết cài vào đâu.',

  'footer.releases': 'Bản phát hành',
  'footer.issues': 'Issues',
  'footer.license': 'Giấy phép',
  'footer.by': 'Phát triển bởi',
  'footer.licenseLine': 'Mã nguồn mở theo giấy phép MIT',
}
