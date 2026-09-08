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

## Video khác gì so với tự quay

- **Con trỏ hiện rõ, di chuyển tự nhiên.** Đi theo đường cong, tăng tốc rồi phanh, hơi vượt khi
  click xa rồi chỉnh lại. Mỗi click có hiệu ứng sóng nhỏ.
- **Nhịp video theo nội dung trên màn hình.** Click chuyển trang thì đi nhanh. Khi có kết quả thì
  dừng đủ lâu để đọc.
- **Cái gì không quay được thì ghi phụ đề.** Menu `<select>` hay hộp thoại chọn file do OS vẽ,
  không nằm trong bản quay trang, nên phụ đề dưới đáy nói đã chọn gì. Phím tắt hiện gợi ý
  (`⌘ + C`) cạnh phần tử nó tác động.
- **Đoạn chờ load bị cắt**, video bắt đầu ngay chỗ công việc bắt đầu.

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

Lệnh một dòng cài release mới nhất, hoặc `main` nếu chưa có release. Dùng `--ref` để chọn bản khác;
lựa chọn được nhớ nên lần update sau vẫn giữ nguyên:

```bash
curl -fsSL … /install.sh | bash -s -- --ref main       # a branch, to try a change before it ships
curl -fsSL … /install.sh | bash -s -- --ref v1.2.0     # a release, to pin a team to one version
curl -fsSL … /install.sh | bash -s -- --ref latest     # back to following releases
```

Update bằng `~/.webapp-evidence/scripts/install-local.sh --update`, gỡ bằng `--uninstall --all`.
Lưu ý: `install.sh` luôn được tải từ nhánh mặc định, nên bản sửa cho chính bộ cài chỉ tới tay bạn
sau khi merge vào đó.

## Ba cách gọi

| platform | how you call it |
|---|---|
| Claude Code | `/webapp-evidence:recording` |
| Cursor, Gemini CLI, Antigravity | `/webapp-evidence-recording` |
| Codex | `$webapp-evidence-recording` |

**Vừa xong một task hoặc bug fix.** Agent đã biết màn nào vừa đổi, không cần gõ thêm:

```
/webapp-evidence:recording
```

**Chỉ có link MR/PR.** Agent đọc mô tả và diff rồi tự suy ra cần quay gì:

```
/webapp-evidence:recording https://gitlab.example.com/group/admin/-/merge_requests/1783
```

**Không viết code.** Đưa URL và nói muốn thấy gì, giống ví dụ trên. Không cần repo, không cần
config, không phải setup. Viết các bước bằng ngôn ngữ nào cũng được; agent trả lời đúng ngôn ngữ đó.

Không cần nhớ cú pháp. Nói "lấy evidence cho màn mình vừa sửa" cũng ra.

## Cấu hình cho project (một lần)

```
/webapp-evidence:recording set up the evidence config for this project
```

Nó tìm màn login và tài khoản dev, rồi ghi ra `evidence.config.js`. Sau đó mọi bản quay đều bắt đầu
đã login, trên môi trường chạy được, không hỏi lại.

Muốn đổi thì nói — "quay chậm hơn", "phụ đề tiếng Nhật", "chỉ giữ bản mới nhất" — nó sửa file đó.

## Giới hạn

Nó quay trang web, không quay màn hình máy bạn. Thứ do OS vẽ sẽ không vào video: dropdown `<select>`,
hộp thoại chọn file, `confirm`/`alert`. Những chỗ đó được thay bằng phụ đề nói đã chọn gì, kèm
screenshot ngay sau đó. Modal, date picker và dropdown viết bằng JS thì quay bình thường.

Chỉ chạy trên local dev hoặc site bạn chỉ định — không đụng staging hay production.

Video và screenshot không commit vào Git. Đính vào ticket, MR/PR, báo cáo là việc của bạn.

---

Bản quay ở trên là output thật từ runner của repo này: `docs/demo/record.sh` tạo ra từ
`docs/demo/saucedemo-steps.js`. Muốn contribute skill này thì xem
**[CONTRIBUTING.md](./CONTRIBUTING.md)**.
