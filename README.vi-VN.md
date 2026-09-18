<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./docs/images/logo/logo-lockup-dark.svg">
    <img src="./docs/images/logo/logo-lockup.svg" alt="webapp-evidence" width="420">
  </picture>
</p>

<p align="center">
  <strong>Mô tả luồng, nhận bản quay.</strong><br>
  <sub>Một lệnh để agent quay web app rồi trả về video, screenshot và runbook. Dùng cho UAT, bàn giao, báo lỗi, review.</sub><br>
  <code>/webapp-evidence:recording</code>
</p>

<p align="center">
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

Có lúc bạn cần chứng minh app chạy đúng: UAT, bàn giao cho team khác, báo bug, demo,
review. Tự quay mất khoảng nửa tiếng mà video vẫn khó xem — screenshot trễ, chuột nhảy lung tung,
dropdown không mở nên người xem không biết bạn chọn gì.

Mô tả luồng cho coding agent. Nó điều khiển Chrome, trả về video, screenshot các bước chính, và
runbook để chạy lại đúng lần đó.

## Ví dụ

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

## Kết quả

<p align="center">
  <img src="./docs/demo/site-tour.gif" width="820" alt="Bản quay tour trang landing: con bướm ở hero phản ứng theo con trỏ, lệnh cài đặt được copy và nút tự xác nhận, rồi trang được đọc dần xuống qua How it works, phần walkthrough review round bấm từng bước, và các card tính năng.">
</p>

GIF là một đoạn của bản quay dài hơn — làm gif cả bản thì nặng gấp mấy lần, README không phải chỗ cho thứ đó. Kèm theo là 25 screenshot các bước chính và runbook. Người nhận đọc là hiểu, không bắt buộc phải xem video:

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

Trong lúc quay, agent cũng theo dõi console và network. Lần này trang sạch lỗi — bản thân điều đó
cũng là một khẳng định người đọc kiểm lại được. Khi có lỗi, từng lỗi nằm ở khối cuối kèm status và
URL — một cú 401 từ request chẳng ai để ý thì screenshot không hiện ra.

Nếu quay ngay trong phiên đang implement, agent nhìn screenshot và log lỗi giống một lượt e2e.
401, layout trượt hay tràn khi hẹp màn — nó chỉ ra và đề xuất cách sửa, không chỉ đưa file.

Runbook còn lưu đúng lệnh đã tạo ra bản quay. Data đổi, video hỏng, hoặc muốn quay chậm hơn thì gọi
lại. Bản cũ giữ thành `v1`, `v2`, … không bị ghi đè. Bản đã gửi đi rồi thì không tạo lại được đúng
file đó.

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

Nó hỏi bạn đang dùng nền tảng nào, rồi cho biết đã cài ở đâu. Quay cần Chrome, ffmpeg và Node —
thiếu cái nào thì agent nói rõ và đề nghị cài giúp.

Để bám theo một nhánh hoặc ghim một phiên bản:

```bash
curl -fsSL https://raw.githubusercontent.com/TOMOSIA-VIETNAM/webapp-evidence/main/install.sh | bash -s -- --ref main
```

`--ref v1.2.0` ghim một phiên bản, `--ref latest` quay lại theo release; những lần chạy sau giữ đúng
cái được yêu cầu gần nhất. Update bằng `~/.webapp-evidence/scripts/install-local.sh --update`, gỡ
bằng `--uninstall --all`.

## Cách dùng

Gọi thế nào thì tuỳ nơi bạn đang ngồi làm:

| platform | command |
|---|---|
| Claude Code | `/webapp-evidence:recording` |
| Cursor, Gemini CLI, Antigravity | `/webapp-evidence-recording` |
| Codex | `$webapp-evidence-recording` |

Những thứ bạn có thể yêu cầu:

| Bạn cần | Gõ gì |
|---|---|
| Bằng chứng cho màn hình bạn vừa sửa | `/webapp-evidence:recording` — nó biết bạn vừa làm gì |
| Bằng chứng cho một MR hoặc PR | `/webapp-evidence:recording https://gitlab.example.com/group/admin/-/merge_requests/1783` |
| Quay một trang theo mô tả của bạn | `/webapp-evidence:recording Page: https://app.example.com/search` rồi liệt kê các bước, như ví dụ ở trên |
| Quay lại đúng bản cũ | `/webapp-evidence:recording quay lại bản đó` — runbook giữ sẵn lệnh, bản cũ không bị ghi đè |
| Quay chậm hơn | `/webapp-evidence:recording quay chậm lại` |
| Chú thích bằng tiếng khác | `/webapp-evidence:recording chú thích tiếng Nhật` — nhớ theo từng dự án |
| Bằng chứng là cú click đã chạm tới backend — job đã chạy, file đã được ghi | `/webapp-evidence:recording mở log worker sau khi bấm Run sync` |
| Muốn chính cái dropdown hay hộp thoại nằm trong video, không phải phụ đề mô tả nó | `/webapp-evidence:recording --screen` — giao máy cho nó khoảng một phút; không có cờ này thì nó hỏi trước |
| Giữ một thông tin nhạy cảm ra khỏi bản quay | `/webapp-evidence:recording làm mờ API key khi nó hiện ra` |
| Cấu hình dự án một lần, để lần sau quay là đã đăng nhập sẵn | `/webapp-evidence:recording set up the evidence config for this project` |

Viết các bước bằng ngôn ngữ nào cũng được, agent trả lời đúng ngôn ngữ đó. Cũng chẳng có cú pháp nào
phải nhớ — nói "lấy evidence cho màn mình vừa sửa" là chạy.

## Khi đã có bản quay

| Bạn cần | Lệnh |
|---|---|
| Một file gif, để nhúng README hay chỗ chỉ hiện được ảnh | `/webapp-evidence:recording -f gif` |
| Một file webm, cho trang web của bạn | `/webapp-evidence:recording -f webm` |
| Biết video cho thấy gì mà không phải ngồi xem hết | `/webapp-evidence:vision <file mp4>` |
| Báo một lỗi, hoặc xin thêm thứ còn thiếu | `/webapp-evidence:feedback` |

mp4 vẫn là mặc định: nó phát thẳng trong merge request, trong issue và mọi công cụ chat, lại nhẹ nhất
trong ba định dạng. Gif của cùng bản quay lớn gấp mấy lần, nên đổi định dạng là thứ agent đề nghị chứ
không tự làm.

`vision` có mặt vì agent không xem được video. Nó cắt video thành lưới ảnh — vài giây một khung, mỗi
khung đóng dấu `mm:ss` — rồi đọc như đọc ảnh. Nhờ vậy phát hiện trả về dạng "header đè lên bảng ở
00:14": một mốc bạn tua lại được và đối chiếu được với runbook. Nó bắt được thứ không ai nghĩ tới
việc chụp: layout vỡ giữa lúc chuyển cảnh, banner loé lên rồi biến mất.

Đây là hai tấm nó tạo ra từ chính bản quay ở trên:
**[tấm 1](./docs/demo/vision-sheet-01.png)** (00:00–00:38) ·
**[tấm 2](./docs/demo/vision-sheet-02.png)** (00:40–01:18) ·
**[tấm 3](./docs/demo/vision-sheet-03.png)** (01:20–01:32).

## Giới hạn

Nó quay trang web, không quay màn hình máy bạn. Thứ do OS vẽ sẽ không vào video: dropdown `<select>`,
hộp thoại chọn file, `confirm`/`alert`. Những chỗ đó được thay bằng phụ đề nói đã chọn gì, kèm
screenshot ngay sau đó. Modal, date picker và dropdown viết bằng JS thì quay bình thường.

Khi chính hộp thoại đó là thứ cần chứng minh, nó quay được cửa sổ trình duyệt thay vì trang, và lúc
đó chúng nằm trong video. Cách này cần màn hình, cần quyền, và cần bạn không đụng máy suốt lượt
quay — nên không phải mặc định. Agent sẽ hỏi bạn trước, và một thông báo hiện lên màn hình chỉ bạn
chỗ có câu hỏi. Muốn đi thẳng thì gõ `/webapp-evidence:recording --screen`.

Thông tin nhạy cảm hiện trên màn có thể làm mờ, che kín hoặc cắt khỏi bản quay — nói ra khi bạn mô
tả luồng, và nó cũng được giữ khỏi ảnh chụp.

Khi bằng chứng không nằm trên trang — một job đã chạy, một file đã được ghi — một bước có thể mở
panel terminal đè lên trang, đưa lệnh thật và output thật vào cùng video. Chỉ nhận output theo
dòng: `vim`, `less`, `htop` không dùng được.

Quay chỉ chạy trên site bạn chỉ định, không gì khác.

Video và screenshot không commit vào Git. Đính vào ticket, MR/PR, báo cáo là việc của bạn.

---

Bản quay ở trên là output thật từ runner của repo này: `docs/demo/record.sh` tạo ra từ
`docs/demo/site-tour-steps.js`. Muốn contribute skill này thì xem
**[CONTRIBUTING.md](./CONTRIBUTING.md)**.
