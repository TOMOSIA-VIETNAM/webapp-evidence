<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./docs/images/logo/logo-lockup-dark.svg">
    <img src="./docs/images/logo/logo-lockup.svg" alt="webapp-evidence" width="420">
  </picture>
</p>

<p align="center">
  <strong>Mô tả luồng. Nhận bản quay.</strong><br>
  <sub>Một câu lệnh quay lại web app của bạn rồi trả về video, screenshot và runbook — dùng cho UAT, bàn giao, báo lỗi và review.</sub><br>
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

Sớm hay muộn cũng có người cần thấy app chạy thật: một buổi UAT cần ký, một lần bàn giao cho nhóm
khác hay cho nhà thầu, một cái bug report, một buổi demo, một lượt review code. Mà tự quay thì mất
cả nửa tiếng, xem vẫn tệ. Screenshot chụp trễ mất một nhịp. Con chuột nhảy loạn khắp màn hình.
Dropdown không mở ra trong video, nên không ai biết bạn vừa chọn gì.

Thay vào đó, hãy mô tả luồng cho coding agent của bạn. Nó điều khiển Chrome rồi trả về một video gọn
gàng, screenshot chụp đúng những khoảnh khắc đáng chú ý, và một runbook quay lại được y hệt lần đó.

## Bạn gõ thế này

```
/webapp-evidence:recording Page: https://www.saucedemo.com
Flow:
1. Log in using standard_user / secret_sauce
2. Change the sort dropdown to "Price (low to high)"
3. Add "Sauce Labs Backpack" to the cart, then open the cart
4. Checkout, fill First Name / Last Name / Zip as Minh / Tang / 700000
5. Continue, then Finish, and stop at the "Thank you for your order!" screen
```

## Bạn nhận về thế này

<p align="center">
  <img src="./docs/demo/saucedemo.gif" width="820" alt="Bản quay luồng checkout của Swag Labs: con trỏ đăng nhập, sắp xếp danh sách sản phẩm theo giá — phụ đề chạy dưới đáy cho biết đã chọn tuỳ chọn nào, vì dropdown do hệ điều hành vẽ ra nên không quay được — thêm một chiếc balo vào giỏ, điền form checkout rồi hoàn tất đơn hàng.">
</p>

Tám screenshot chụp đúng những khoảnh khắc đáng chú ý. Và một runbook, để người nhận chỉ cần đọc là
hiểu, không phải xem:

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

Phần cuối là món quà thêm. Vừa quay, nó vừa theo dõi console và network — nên ở đây người đọc biết
được trang đang trả về lỗi 401. Không screenshot nào cho thấy điều đó, và cũng chẳng ai đi tìm.

Runbook còn giữ đúng câu lệnh đã tạo ra bản quay đó. Dữ liệu đã đổi, video hỏng, người xem muốn chậm
hơn? Cứ yêu cầu lại. Các bản quay cũ được giữ thành `v1`, `v2`, … và không bao giờ bị ghi đè, vì bản
quay đã gửi đi rồi là thứ duy nhất bạn không tạo lại được.

## Vì sao video này xem được

- **Con trỏ hiện rõ và di chuyển như tay người.** Đường đi cong, tăng tốc nhanh, hãm chậm, lỡ đà một
  chút khi đích ở xa rồi chỉnh lại. Mỗi cú click để lại một gợn sóng.
- **Nhịp quay bám theo màn hình.** Những cú click chỉ để chuyển trang thì đi nhanh. Đến lúc kết quả
  hiện ra thì giữ đủ lâu để đọc.
- **Thứ gì khung hình không quay được thì nói bằng phụ đề.** Menu `<select>` hay hộp thoại chọn file
  do hệ điều hành vẽ, không bao giờ lọt vào bản quay trang, nên phụ đề dưới đáy sẽ nói đã chọn gì.
  Phím tắt thì hiện gợi ý phím (`⌘ + C`) ngay cạnh phần tử nó tác động.
- **Đoạn chờ tải trang bị cắt bỏ**, để video bắt đầu ngay chỗ công việc bắt đầu.

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

Nó hỏi bạn dùng nền tảng nào, rồi báo lại đã đặt mọi thứ ở đâu. Việc quay cần Chrome, ffmpeg và Node
— thiếu cái nào thì agent nói rõ và đề nghị cài giúp.

Câu lệnh một dòng này cài release mới nhất, hoặc `main` khi chưa có release nào. Dùng `--ref` để chọn
thứ khác; lựa chọn đó được ghi nhớ, nên lần cập nhật sau bạn vẫn ở đúng chỗ mình đã chọn:

```bash
curl -fsSL … /install.sh | bash -s -- --ref main       # a branch, to try a change before it ships
curl -fsSL … /install.sh | bash -s -- --ref v1.2.0     # a release, to pin a team to one version
curl -fsSL … /install.sh | bash -s -- --ref latest     # back to following releases
```

Cập nhật bằng `~/.webapp-evidence/scripts/install-local.sh --update`, gỡ bằng `--uninstall --all`.
Một lưu ý: `install.sh` luôn được tải từ nhánh mặc định, nên bản sửa cho chính bộ cài chỉ đến tay bạn
sau khi nó được merge vào đó.

## Ba cách để yêu cầu

| platform | how you call it |
|---|---|
| Claude Code | `/webapp-evidence:recording` |
| Cursor, Gemini CLI, Antigravity | `/webapp-evidence-recording` |
| Codex | `$webapp-evidence-recording` |

**Bạn vừa xong một task hoặc một bug fix.** Agent đã biết màn hình nào vừa đổi, nên không cần gõ gì
thêm phía sau:

```
/webapp-evidence:recording
```

**Bạn chỉ có mỗi cái link.** Nó đọc MR/PR — cả mô tả lẫn diff — rồi tự suy ra cần quay những gì:

```
/webapp-evidence:recording https://gitlab.example.com/group/admin/-/merge_requests/1783
```

**Bạn không viết code.** Đưa trang cần quay và nói muốn thấy gì, đúng như ví dụ ở trên. Không cần
repository, không cần config, không phải dựng gì cả. Viết các bước bằng ngôn ngữ nào bạn đang nghĩ
cũng được; agent trả lời bằng đúng ngôn ngữ đó.

Cũng chẳng có cú pháp nào phải nhớ — nói "lấy evidence cho màn hình tôi vừa sửa" là ra đúng thứ đó.

## Trỏ nó vào project của bạn một lần

```
/webapp-evidence:recording set up the evidence config for this project
```

Nó tìm màn hình đăng nhập và một tài khoản dev, rồi ghi ra `evidence.config.js`. Từ đó về sau, mọi
bản quay đều bắt đầu ở trạng thái đã đăng nhập, trên một môi trường chạy được, không phải hỏi lại.

Muốn đổi gì thì cứ nói — "quay chậm lại", "phụ đề tiếng Nhật", "chỉ giữ bản quay mới nhất" — nó sửa
file đó giúp bạn.

## Vài giới hạn nên biết

Nó quay trang web, không quay màn hình của bạn. Nên mọi thứ do hệ điều hành vẽ đều nằm ngoài khung
hình: dropdown `<select>`, hộp thoại chọn file, hộp thoại `confirm`/`alert`. Những khoảnh khắc đó
được thay bằng phụ đề nói rõ đã chọn gì, kèm một screenshot chụp trạng thái ngay sau đó. Modal, date
picker và dropdown viết bằng JS thì vẫn quay bình thường.

Việc quay chỉ chạy trên môi trường dev local hoặc một site bạn chỉ định — không bao giờ đụng vào
staging hay production.

Video và screenshot không nằm trong Git. Đính chúng vào đâu — ticket, MR/PR, báo cáo — là việc của
bạn.

---

Bản quay ở trên là output thật từ runner của repository này: `docs/demo/record.sh` tạo ra nó từ
`docs/demo/saucedemo-steps.js`. Muốn góp tay vào chính skill này? Xem
**[CONTRIBUTING.md](./CONTRIBUTING.md)**.
