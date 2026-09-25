<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./docs/images/logo/logo-lockup-dark.svg">
    <img src="./docs/images/logo/logo-lockup.svg" alt="Webapp Evidence" width="420">
  </picture>
</p>

<p align="center">
  <strong>Mô tả luồng, nhận bản quay.</strong><br>
  <sub>Một lệnh để agent quay web app rồi trả về video, screenshot và runbook. Dùng cho UAT, bàn giao, báo lỗi, review.</sub><br>
  <code>/webapp-evidence:recording</code>
</p>

<p align="center">
  <a href="https://evdrec.vercel.app"><img alt="Website: evdrec.vercel.app" src="https://img.shields.io/badge/website-evdrec.vercel.app-5C8F0F?style=flat-square"></a>
  <a href="./LICENSE"><img alt="License: MIT" src="https://img.shields.io/github/license/TOMOSIA-VIETNAM/webapp-evidence?style=flat-square&color=blue"></a>
  <a href="#cài-đặt"><img alt="Claude Code" src="https://img.shields.io/badge/Claude_Code-supported-D97757?style=flat-square&logo=anthropic&logoColor=white"></a>
  <a href="#cài-đặt"><img alt="Cursor" src="https://img.shields.io/badge/Cursor-supported-000000?style=flat-square&logo=cursor&logoColor=white"></a>
  <a href="#cài-đặt"><img alt="Codex" src="https://img.shields.io/badge/Codex-supported-412991?style=flat-square&logo=openai&logoColor=white"></a>
  <a href="#cài-đặt"><img alt="Gemini CLI" src="https://img.shields.io/badge/Gemini_CLI-supported-4285F4?style=flat-square&logo=google&logoColor=white"></a>
  <a href="#cài-đặt"><img alt="Antigravity" src="https://img.shields.io/badge/Antigravity-supported-6E56CF?style=flat-square"></a>
</p>

<p align="center">
  <a href="./README.md">English</a> · <strong>Tiếng Việt</strong> · <a href="./README.ja-JP.md">日本語</a> · <a href="./README.zh-Hans.md">简体中文</a>
</p>

AI làm xong thay đổi rất nhanh. Chứng minh nó chạy đúng thì không nhanh lên — UAT, bàn giao, báo
lỗi, review đều đòi cùng một thứ, và tự quay vẫn tốn khoảng nửa tiếng.

**`webapp-evidence` quay bằng chứng đó giúp bạn.** Mô tả luồng cho chính coding agent bạn đang
dùng; nó lái Chrome rồi trả về video, screenshot các bước chính, và một runbook.

<p align="center">
  <a href="https://evdrec.vercel.app"><img src="./docs/demo/evd-tour.gif" width="820" alt="Trang landing của webapp-evidence tự quay chính nó: lệnh được copy, một panel terminal mở đè lên trang và đọc lại thẻ SEO trang trả về, rồi từng tiêu chí nghiệm thu trong báo cáo UAT được chọn và sáng lên đúng những dòng runbook chứng minh nó."></a><br>
  <sub>Trang landing của chính dự án này, do chính skill mà nó giới thiệu quay lại. Một lần quay, không cắt ghép.</sub>
</p>

- **Một bản quay, ba loại bằng chứng** — màn hình, endpoint gọi bằng chính session trình duyệt đang
  giữ, và dòng dữ liệu nó ghi xuống database. Một video, một runbook.
- **Xem như người thật thao tác** — con trỏ di chuyển, nhịp gõ không đều, cú cuộn dừng đúng chỗ nó
  vừa tới. Không có gì nhảy cóc.
- **Runbook, không chỉ là file** — timeline, caption, các lệnh đã chạy, lỗi trang gặp phải, và lệnh
  tạo lại đúng bản quay đó.
- **Secret nằm ngoài** — làm mờ, bôi đen hoặc cắt hẳn một đoạn, trong cả video lẫn screenshot.
- **Không có gì rời khỏi máy bạn** — không service, không bot account; chạy ngay trong agent CLI bạn
  đã có, chỉ vào đúng site bạn chỉ định.

## Sinh ra cho UAT

Kiểm thử nghiệm thu vẫn là một người bấm qua từng tiêu chí rồi tự quay lại. Hãy viết tiêu chí thành
một luồng, rồi ký duyệt dựa trên mốc thời gian:

| 1 · Viết tiêu chí | 2 · Quay một lần | 3 · Đọc runbook | 4 · Ký duyệt |
|---|---|---|---|
| Các bước đánh số bằng lời thường, ngôn ngữ nào cũng được — hoặc một link MR/PR, agent tự suy ra luồng từ diff. | Chrome được lái bằng một con trỏ nhìn thấy được. Bước gọi endpoint assert status, nên câu trả lời sai dừng bản quay. | Mỗi bước kèm thời điểm trong video, mỗi lệnh kèm exit code, mọi lỗi console và request thất bại. | Người duyệt đối chiếu từng tiêu chí với một mốc thời gian thay vì tự chạy lại luồng. Sửa xong thì `record that again`. |

Bản quay ở trên chính là vòng đó chạy trên site của dự án:
**[evdrec.vercel.app](https://evdrec.vercel.app)** đọc lại bản quay của chính nó như một báo cáo UAT.

## Một bản quay chứng minh được gì

Quay màn hình chỉ cho thấy một nửa của thay đổi fullstack. Cùng bản quay đó có thể gọi API bằng
session trình duyệt đang giữ, rồi đọc lại database:

```
/webapp-evidence:recording Page: https://app.example.com/orders
Flow:
1. Create an order for SKU ABC, quantity 2
2. Call POST /api/orders and show it answering 201
3. Query the orders table and show the row that appeared
```

- **Màn hình.** Form được điền và submit bởi một con trỏ nhìn thấy được, ở nhịp người xem đọc kịp.
- **Endpoint.** Một panel terminal mở đè lên trang, curl chạy trong đó với cookie của chính trình
  duyệt — `HTTP 201 in 0.184s`, hiện trên video. Bước này assert status, nên status sai là hỏng bản
  quay chứ không đi ra ngoài dưới dạng bằng chứng.
- **Database.** `psql`, `mysql`, một rake task — thứ bạn vẫn tự chạy, chạy trong đúng panel đó, dòng
  mới nằm cùng khung hình với màn hình vừa tạo ra nó.

Cookie và token tới curl qua file và được che ở mọi nơi: video, screenshot, runbook.

## Nhận về những gì

`<name>.mp4`, các screenshot đánh số, và `<name>-runbook.md` — để người nhận đọc bản quay thay vì
phải ngồi xem. Từ bản quay ở trên:

```markdown
## Steps in the video

00:05 - 00:17  Terminal — the SEO meta the page serves, read off its URL
00:24 - 00:41  UAT report — each criterion picks out the runbook lines that prove it
00:59 - 01:07  Install — one panel per agent

## Commands run in the terminal

- 00:12  `curl -s https://evdrec.vercel.app/ | grep -oE '<title>[^<]*</title>|…'` — exit 0

## Page errors recorded during the take

- none
```

Trong lúc quay nó theo dõi console và network, nên một cú 401 từ request chẳng ai để ý sẽ nằm ở khối
cuối kèm status và URL. Quay ngay trong phiên bạn vừa làm tính năng thì agent đọc lại screenshot và
lỗi như một lượt e2e rồi đề xuất cách sửa, chứ không chỉ đưa file.

Không có gì bị commit vào Git. Đính kèm vào ticket, MR hay báo cáo là việc của bạn.

## Cài đặt

**Claude Code**

```bash
claude plugin marketplace add TOMOSIA-VIETNAM/webapp-evidence
claude plugin install webapp-evidence@webapp-evidence
```

**Cursor, Codex, Gemini CLI, Antigravity**

```bash
curl -fsSL https://raw.githubusercontent.com/TOMOSIA-VIETNAM/webapp-evidence/main/install.sh | bash
```

Nó hỏi bạn dùng nền tảng nào rồi báo mọi thứ nằm ở đâu. Quay cần Chrome, ffmpeg và Node; thiếu cái
nào agent gọi tên cái đó và đề nghị cài giúp.

Để ghim một release hoặc bám theo branch:

```bash
curl -fsSL https://raw.githubusercontent.com/TOMOSIA-VIETNAM/webapp-evidence/main/install.sh | bash -s -- --ref v1.1.3
```

`--ref main` bám theo branch, `--ref latest` quay về nhánh release; những lần chạy sau giữ nguyên
thứ được yêu cầu gần nhất. Cập nhật bằng `~/.webapp-evidence/scripts/install-local.sh --update`, gỡ
bằng `--uninstall --all`.

Gõ lệnh ở đâu thì tuỳ nền tảng: `/webapp-evidence:recording` trong Claude Code,
`/webapp-evidence-recording` trong Cursor, Gemini CLI và Antigravity, `$webapp-evidence-recording`
trong Codex.

## Các kiểu yêu cầu

Không có cú pháp nào phải học. *"Lấy evidence cho màn hình tôi vừa sửa"* là chạy, viết bằng ngôn ngữ
nào agent trả lời bằng ngôn ngữ đó.

| Bạn muốn | Gõ thế này |
|---|---|
| Evidence cho màn hình bạn vừa sửa | `/webapp-evidence:recording` — nó biết bạn đang làm gì |
| Evidence cho một MR hoặc PR | `/webapp-evidence:recording https://gitlab.example.com/group/admin/-/merge_requests/1783` |
| Quay lại đúng bản đó sau khi dữ liệu đổi | `/webapp-evidence:recording record that again` — bản cũ giữ lại thành `v1`, `v2`, … |
| Quay chậm lại, hoặc caption ngôn ngữ khác | `record it slower`, `captions in Japanese` — nhớ theo từng project |
| Giữ một secret ra khỏi bản quay | `blur the API key when it appears` |
| Chính cái dropdown hay dialog có trong video | `--screen` — quay cửa sổ trình duyệt, nên thứ hệ điều hành vẽ cũng vào khung |
| Không đụng tới màn hình, dù luồng là gì | `--headless` — mặc định, và là cách chốt thẳng câu hỏi đó |
| Gif cho README, webm cho trang bạn tự quản | `-f gif`, `-f webm` — còn lại là mp4, vì nó phát inline ở mọi nơi |
| Biết video cho thấy gì mà không phải xem | `/webapp-evidence:vision <the mp4>` — xem bên dưới |
| Bản quay bắt đầu ở trạng thái đã đăng nhập | `/webapp-evidence:recording set up the evidence config for this project` |
| Báo có thứ sai, hoặc còn thiếu | `/webapp-evidence:feedback` |

## Đọc lại một bản quay

Agent không xem được video. `vision` xếp video thành các contact sheet — khung hình cách đều, mỗi
khung đóng dấu `mm:ss` — nên phát hiện quay về dạng "header đè lên bảng ở 00:14", một mốc bạn đối
chiếu được với runbook. Bản quay ở trên, theo cách agent đọc nó:

<p align="center">
  <a href="./docs/demo/vision-sheet-01.png"><img src="./docs/demo/vision-sheet-01.png" width="268" alt="Contact sheet 1 của bản quay ở trên"></a>
  <a href="./docs/demo/vision-sheet-02.png"><img src="./docs/demo/vision-sheet-02.png" width="268" alt="Contact sheet 2 của bản quay ở trên"></a>
  <a href="./docs/demo/vision-sheet-03.png"><img src="./docs/demo/vision-sheet-03.png" width="268" alt="Contact sheet 3 của bản quay ở trên"></a>
</p>

## Giới hạn

Nó quay trang, không quay màn hình của bạn, nên thứ hệ điều hành vẽ nằm ngoài: dropdown `<select>`,
hộp chọn file, dialog `confirm`/`alert`. Mỗi thứ được thay bằng một caption nói đã chọn gì cộng một
screenshot ngay sau đó; modal, date picker và dropdown viết bằng JS thì quay bình thường. Khi chính
mấy dialog đó *là* bằng chứng, `--screen` quay cửa sổ trình duyệt — cách này cần màn hình, cần bạn
cho phép, và cần để máy yên trong lúc quay, nên agent hỏi trước.

Panel terminal nhận output theo dòng: `vim`, `less` và `htop` nằm ngoài.

---

Bản quay ở trên là output thật từ runner của repo này: `docs/demo/record.sh` quay site trong
`webapp/` theo `docs/demo/tour-steps.js`, và cùng bản quay đó đang phát trên
[evdrec.vercel.app](https://evdrec.vercel.app). Muốn sửa chính skill này thì xem
**[CONTRIBUTING.md](./CONTRIBUTING.md)**.
