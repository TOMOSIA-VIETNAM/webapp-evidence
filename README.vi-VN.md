<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./docs/images/logo/logo-lockup-dark.svg">
    <img src="./docs/images/logo/logo-lockup.svg" alt="Webapp Evidence" width="420">
  </picture>
</p>

<h3 align="center">Mô tả luồng. Nhận về bản quay.</h3>

<p align="center">
  <sub>
    <a href="./README.md">English</a> · <strong>Tiếng Việt</strong> · <a href="./README.ja-JP.md">日本語</a> · <a href="./README.zh-Hans.md">简体中文</a>
    &nbsp;&nbsp;|&nbsp;&nbsp; <a href="https://evdrec.vercel.app">evdrec.vercel.app</a> · <a href="./LICENSE">MIT</a>
  </sub>
</p>

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./docs/images/readme/pipeline.vi-VN-dark.svg">
    <img src="./docs/images/readme/pipeline.vi-VN.svg" width="900" alt="Mô tả luồng, agent lái Chrome, rồi trả về video, screenshot và runbook">
  </picture>
</p>

<p align="center">
  <a href="https://evdrec.vercel.app"><img src="./docs/demo/evd-tour.gif" width="820" alt="Trang landing của webapp-evidence tự quay chính nó: lệnh được copy, một panel terminal mở đè lên trang và đọc lại thẻ SEO trang trả về, rồi từng tiêu chí nghiệm thu trong báo cáo UAT được chọn và sáng lên đúng những dòng runbook chứng minh nó."></a><br>
  <sub>Trang landing của chính dự án này, do chính skill mà nó giới thiệu quay lại. Một lần quay, không cắt ghép.</sub>
</p>

## Một bản quay chứng minh được gì

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./docs/images/readme/proofs.vi-VN-dark.svg">
    <img src="./docs/images/readme/proofs.vi-VN.svg" width="900" alt="Một bản quay cho thấy màn hình, endpoint gọi bằng session của trình duyệt, và dòng trong database">
  </picture>
</p>

```
/webapp-evidence:recording Page: https://app.example.com/orders
Flow:
1. Create an order for SKU ABC, quantity 2
2. Call POST /api/orders and show it answering 201
3. Query the orders table and show the row that appeared
```

<sub>Cookie tới curl qua một file, không bao giờ nằm trên dòng lệnh. Status sai làm hỏng bản quay thay vì
thành bằng chứng. `recording.terminal.scrub` chỉ che đúng phần chữ nó khớp.</sub>

## Sinh ra cho UAT

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./docs/images/readme/uat.vi-VN-dark.svg">
    <img src="./docs/images/readme/uat.vi-VN.svg" width="900" alt="Viết tiêu chí, quay một lần, đọc runbook, ký duyệt; sửa xong thì quay lại">
  </picture>
</p>

<p align="center"><sub>Bản quay ở trên chính là vòng đó, chạy trên site của dự án:
<a href="https://evdrec.vercel.app">evdrec.vercel.app</a> đọc lại bản quay của nó như một báo cáo UAT.</sub></p>

## Và không cần ai nhắc

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./docs/images/readme/traits.vi-VN-dark.svg">
    <img src="./docs/images/readme/traits.vi-VN.svg" width="900" alt="Như người thật thao tác, xem xong rồi sửa, bắt lỗi console, không rời khỏi máy bạn">
  </picture>
</p>

<details>
<summary><b>Runbook trông thế nào</b> — bản quay ở trên, đúng như người nhận đọc nó</summary>

```markdown
## Steps in the video

00:05 - 00:17  Terminal — the SEO meta the page serves, read off its URL
00:24 - 00:40  UAT report — each criterion picks out the runbook lines that prove it
00:58 - 01:06  Install — one panel per agent

## Commands run in the terminal

- 00:12  `curl -s https://evdrec.vercel.app/ | grep -oE '<title>[^<]*</title>|…'` — exit 0

## Page errors recorded during the take

- none
```

</details>

## Đọc lại một bản quay

Agent không xem được video. `vision` xếp video thành các tấm ảnh đóng dấu `mm:ss`, nên phát hiện trả
về sẽ là *"header đè lên bảng ở 00:14"*.

<p align="center">
  <a href="./docs/demo/vision-sheet-01.png"><img src="./docs/demo/vision-sheet-01.png" width="268" alt="Contact sheet 1 của bản quay ở trên"></a>
  <a href="./docs/demo/vision-sheet-02.png"><img src="./docs/demo/vision-sheet-02.png" width="268" alt="Contact sheet 2 của bản quay ở trên"></a>
  <a href="./docs/demo/vision-sheet-03.png"><img src="./docs/demo/vision-sheet-03.png" width="268" alt="Contact sheet 3 của bản quay ở trên"></a>
</p>

## Cài đặt

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./docs/images/readme/platforms.vi-VN-dark.svg">
    <img src="./docs/images/readme/platforms.vi-VN.svg" width="900" alt="Chạy trong Claude Code, Cursor, Codex, Gemini CLI và Antigravity">
  </picture>
</p>

**Claude Code**

```bash
claude plugin marketplace add TOMOSIA-VIETNAM/webapp-evidence
claude plugin install webapp-evidence@webapp-evidence
```

**Cursor, Codex, Gemini CLI, Antigravity**

```bash
curl -fsSL https://raw.githubusercontent.com/TOMOSIA-VIETNAM/webapp-evidence/main/install.sh | bash
```

Cần Chrome, ffmpeg và Node — thiếu cái nào agent gọi tên cái đó và đề nghị cài giúp. Sau đó gõ
`/webapp-evidence:recording` trong Claude Code, `/webapp-evidence-recording` trong Cursor, Gemini CLI
và Antigravity, `$webapp-evidence-recording` trong Codex.

<details>
<summary><b>Ghim một release, cập nhật, gỡ cài đặt</b></summary>

```bash
curl -fsSL https://raw.githubusercontent.com/TOMOSIA-VIETNAM/webapp-evidence/main/install.sh | bash -s -- --ref v1.1.3
```

`--ref main` bám theo branch, `--ref latest` quay về nhánh release; những lần chạy sau giữ nguyên
thứ được yêu cầu gần nhất. Cập nhật bằng `~/.webapp-evidence/scripts/install-local.sh --update`, gỡ
bằng `--uninstall --all`.

</details>

## Các kiểu yêu cầu

Không có cú pháp nào phải học — *"lấy evidence cho màn hình tôi vừa sửa"* là đủ, ngôn ngữ nào cũng được.

| Bạn muốn | Gõ |
|---|---|
| Màn hình bạn vừa sửa | `/webapp-evidence:recording` |
| Một MR hoặc PR | `/webapp-evidence:recording https://gitlab.example.com/group/admin/-/merge_requests/1783` |
| Quay lại, dữ liệu đã đổi | `record that again` — bản cũ giữ thành `v1`, `v2`, … |
| Chậm hơn, hoặc caption khác | `record it slower`, `captions in Japanese` — nhớ theo từng project |
| Sửa bản quay đã xong | `cover the API key in step 3`, `twice as fast` |
| Dropdown hay dialog có trong khung | `--screen` — quay cửa sổ trình duyệt |
| Không đụng tới màn hình | `--headless` — mặc định |
| Gif hoặc webm | `-f gif`, `-f webm` — còn lại là mp4 |
| Video cho thấy gì | `/webapp-evidence:vision <the mp4>` |
| Bắt đầu ở trạng thái đã đăng nhập | `set up the evidence config for this project` |
| Báo lỗi | `/webapp-evidence:feedback` |

## Giới hạn

Nó quay trang, không quay màn hình của bạn: menu `<select>`, hộp chọn file và `confirm`/`alert` được
thay bằng caption kèm screenshot — hoặc dùng `--screen`, agent sẽ hỏi trước. Panel terminal nhận output
theo từng dòng, nên `vim`, `less` và `htop` không dùng được.

---

<sub>Mọi hình ở đây do `docs/images/readme/build-readme-art.py` vẽ; bản quay là `docs/demo/record.sh`
chạy trên `webapp/`. Muốn làm việc trên chính skill, xem **[CONTRIBUTING.md](./CONTRIBUTING.md)**.</sub>
