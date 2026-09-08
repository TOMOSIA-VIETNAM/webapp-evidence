<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./docs/images/logo/logo-lockup-dark.svg">
    <img src="./docs/images/logo/logo-lockup.svg" alt="webapp-evidence" width="420">
  </picture>
</p>

<p align="center">
  <strong>Bằng chứng tự quay lấy chính nó.</strong><br>
  <sub>Yêu cầu một lần. Nhận về video, screenshot và một runbook đưa thẳng cho reviewer.</sub><br>
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

Đính bằng chứng vào một merge request thường kết thúc bằng một screenshot chụp trượt mất khoảnh khắc
cần chụp, hoặc một bản quay màn hình mà con chuột nhảy cóc, dropdown không bao giờ mở ra, và không ai
biết nút nào vừa được bấm. Thế nên phần lớn thay đổi lên thẳng mà chẳng có bằng chứng nào, còn review
thì diễn ra bằng niềm tin.

## Bạn yêu cầu thế này

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

Kèm theo là tám screenshot chụp đúng những khoảnh khắc đáng chú ý, và một runbook mà reviewer đọc là
hiểu, không cần xem gì cả:

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

Phần cuối cùng đó mới là thứ không ai ngờ tới. Trong lúc quay, runner theo dõi luôn console và
network, nên reviewer biết được trang đang bắn lỗi 401 — điều mà không screenshot nào cho thấy, và
cũng chẳng ai đi tìm.

Runbook còn chứa đúng câu lệnh để quay lại y hệt lần đó. Dữ liệu đã đổi, video hỏng, reviewer muốn
chậm hơn: cứ yêu cầu lại. Bản quay cũ được giữ trong `v1`, `v2`… chứ không bị ghi đè, vì bằng chứng
đã gửi kèm MR là thứ duy nhất bạn không thể tạo lại.

## Vì sao nó đáng thời gian của reviewer

- **Con trỏ hiện rõ và di chuyển như tay người** — đường đi cong, tăng tốc nhanh, hãm chậm, lỡ đà
  một chút khi đích ở xa rồi chỉnh lại. Mỗi cú click để lại một gợn sóng.
- **Nhịp quay bám theo màn hình.** Những cú click chỉ để chuyển trang thì đi nhanh; đến lúc kết quả
  hiện ra thì giữ đủ lâu để đọc.
- **Thứ khung hình không giữ được thì nói thành lời.** Menu `<select>` và hộp thoại chọn file do hệ
  điều hành vẽ, không bao giờ lọt vào bản quay trang — nên phụ đề dưới đáy sẽ nói đã chọn gì. Phím
  tắt thì hiện overlay gợi ý phím (`⌘ + C`) ngay cạnh phần tử mà nó tác động.
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

Nó hỏi bạn muốn dùng nền tảng nào rồi báo lại đã đặt mọi thứ ở đâu. Việc quay cần Chrome, ffmpeg và
Node trên máy — thiếu cái gì thì agent nói rõ và đề nghị cài giúp.

Câu lệnh một dòng này cài release mới nhất, hoặc `main` khi chưa có release nào. `--ref` cho phép
chọn thứ khác và được ghi nhớ, nên lần cập nhật sau bạn vẫn ở đúng chỗ mình đã chọn:

```bash
curl -fsSL … /install.sh | bash -s -- --ref main       # a branch, to try a change before it ships
curl -fsSL … /install.sh | bash -s -- --ref v1.2.0     # a release, to pin a team to one version
curl -fsSL … /install.sh | bash -s -- --ref latest     # back to following releases
```

Cập nhật bằng `~/.webapp-evidence/scripts/install-local.sh --update`, gỡ bằng `--uninstall --all`.
Lưu ý `install.sh` luôn được tải từ nhánh mặc định, nên một thay đổi trong chính bộ cài chỉ đến tay
bạn sau khi nó được merge vào đó.

## Cách gọi

| platform | how you call it |
|---|---|
| Claude Code | `/webapp-evidence:recording` |
| Cursor, Gemini CLI, Antigravity | `/webapp-evidence-recording` |
| Codex | `$webapp-evidence-recording` |

**Vừa xong một task hoặc một bug fix.** Agent đã biết màn hình nào vừa đổi, nên không cần gõ thêm gì
phía sau:

```
/webapp-evidence:recording
```

**Bạn chỉ có mỗi cái link.** Nó đọc MR/PR — cả mô tả lẫn diff — rồi tự suy ra cần quay những gì:

```
/webapp-evidence:recording https://gitlab.example.com/group/admin/-/merge_requests/1783
```

**Bạn không viết code.** Đưa trang cần quay và nói muốn thấy gì, đúng như ví dụ ở trên. Không cần
repository, không cần config, không phải dựng gì cả. Viết kịch bản bằng ngôn ngữ nào bạn đang nghĩ
cũng được; agent trả lời bằng đúng ngôn ngữ đó.

Cũng chẳng có cú pháp nào phải nhớ — nói "lấy evidence cho màn hình tôi vừa sửa" là ra đúng thứ đó.

## Trong một project

Trỏ nó vào một project một lần, nó sẽ học được cách vào:

```
/webapp-evidence:recording set up the evidence config for this project
```

Nó dò màn hình đăng nhập, tìm một tài khoản dev, rồi ghi ra `evidence.config.js`. Từ đó về sau, mọi
bản quay đều bắt đầu ở trạng thái đã đăng nhập trên một môi trường chạy được mà không phải hỏi lại.

Cứ nói bạn muốn đổi gì — "quay chậm lại", "phụ đề tiếng Nhật", "chỉ giữ bản quay mới nhất" — nó sẽ
sửa file đó giúp bạn.

## Vài giới hạn nên biết

Video quay trang web chứ không quay màn hình của bạn, nên mọi thứ do hệ điều hành vẽ đều nằm ngoài
khung hình: dropdown `<select>`, hộp thoại chọn file, hộp thoại `confirm`/`alert`. Những khoảnh khắc
đó được thay bằng phụ đề nói rõ đã chọn gì, kèm một screenshot chụp trạng thái ngay sau đó. Modal,
date picker và dropdown viết bằng JS thì vẫn quay bình thường.

Việc quay chỉ chạy trên môi trường dev local hoặc một site bạn chỉ định — không bao giờ đụng vào
staging hay production.

Video và screenshot không nằm trong Git. Bạn tự đính chúng vào MR/PR.

---

Bản quay ở trên là output thật từ runner của repository này: `docs/demo/record.sh` tạo ra nó từ
`docs/demo/saucedemo-steps.js`. Muốn góp tay vào chính skill này? Xem
**[CONTRIBUTING.md](./CONTRIBUTING.md)**.
