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
/webapp-evidence:recording Page: https://www.saucedemo.com
Flow:
1. Log in using standard_user / secret_sauce
2. Change the sort dropdown to "Price (low to high)"
3. Add "Sauce Labs Backpack" to the cart, then open the cart
4. Checkout, fill First Name / Last Name / Zip as Minh / Tang / 700000
5. Continue, then Finish, and stop at the "Thank you for your order!" screen
```

## Kết quả

<p align="center">
  <img src="./docs/demo/saucedemo.gif" width="820" alt="Bản quay checkout Swag Labs: đăng nhập, sort sản phẩm theo giá (phụ đề ghi option đã chọn vì dropdown do OS vẽ nên không quay được), thêm balo vào giỏ, điền form checkout rồi hoàn tất đơn.">
</p>

Tám screenshot các bước chính, kèm runbook. Người nhận đọc là hiểu, không bắt buộc phải xem video:

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

Trong lúc quay, agent cũng theo dõi console và network. Ví dụ này cho thấy trang đang trả 401 —
screenshot không hiện, và thường chẳng ai nghĩ tới.

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

Thêm `--ref main` hoặc `--ref v1.2.0` để bám một nhánh hoặc ghim một phiên bản, `--ref latest` để
quay lại theo release; update bằng `~/.webapp-evidence/scripts/install-local.sh --update`, gỡ bằng
`--uninstall --all`.

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
**[tấm 1](./docs/demo/vision-sheet-01.png)** (00:00–00:19) ·
**[tấm 2](./docs/demo/vision-sheet-02.png)** (00:20–00:36).

## Giới hạn

Nó quay trang web, không quay màn hình máy bạn. Thứ do OS vẽ sẽ không vào video: dropdown `<select>`,
hộp thoại chọn file, `confirm`/`alert`. Những chỗ đó được thay bằng phụ đề nói đã chọn gì, kèm
screenshot ngay sau đó. Modal, date picker và dropdown viết bằng JS thì quay bình thường.

Khi bằng chứng không nằm trên trang — một job đã chạy, một file đã được ghi — một bước có thể mở
panel terminal đè lên trang, đưa lệnh thật và output thật vào cùng video. Chỉ nhận output theo
dòng: `vim`, `less`, `htop` không dùng được.

Chỉ chạy trên local dev hoặc site bạn chỉ định — không đụng staging hay production.

Video và screenshot không commit vào Git. Đính vào ticket, MR/PR, báo cáo là việc của bạn.

---

Bản quay ở trên là output thật từ runner của repo này: `docs/demo/record.sh` tạo ra từ
`docs/demo/saucedemo-steps.js`. Muốn contribute skill này thì xem
**[CONTRIBUTING.md](./CONTRIBUTING.md)**.
