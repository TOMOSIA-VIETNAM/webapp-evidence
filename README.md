# get-evidence

Quay lại thao tác trên app dev thành **video + ảnh + runbook** để đính lên MR/PR.

Video được làm cho người xem chứ không phải cho máy: có con trỏ chuột hiển thị, mỗi lần bấm có hiệu
ứng, thao tác bằng phím tắt có bảng chú thích phím hiện lên, tốc độ đủ chậm để theo kịp, và phần
chờ trang load bị cắt bỏ.

Nhịp thao tác mô phỏng người thật: con trỏ đi đường hơi cong, tăng tốc nhanh rồi hãm dần, đi xa thì
vượt qua đích một chút rồi chỉnh lại; quãng chờ không đều nhau; những cú click chỉ để đi tiếp thì
bấm liền tay, chỗ có kết quả cần đọc thì dừng lâu hơn.

## Dùng khi nào

Gõ trong phiên chat với Claude:

**Vừa code xong một task/bug — Claude đã biết màn hình vừa sửa:**

```
/get-evidence
```

**Phiên mới, chỉ có link MR/PR — Claude đọc MR rồi tự suy ra màn cần quay:**

```
/get-evidence https://gitlab.example.com/group/admin/-/merge_requests/1783
```

**Chỉ định thẳng màn hình và flow:**

```
/get-evidence màn /users/new, quay flow nhập form rồi bấm đăng ký
```

**Chỉ cần ảnh, không cần video:**

```
/get-evidence chụp màn danh sách sau khi fix, không cần quay video
```

**Quay lại bản cũ (dữ liệu đổi, video hỏng, hoặc cần bản mới):**

```
/get-evidence quay lại evidence của ISSUE-421
```

**Dự án mới, chưa có cấu hình:**

```
/get-evidence dựng config evidence cho dự án này
```

Không nhớ cú pháp cũng không sao — nói "lấy evidence cho màn vừa sửa" là đủ.

## Kết quả nhận được

Trong thư mục evidence của issue:

```
user-search.mp4                        video thao tác
user-search-runbook.md                 timeline + phím tắt + chú thích + cách chạy lại
01-index.png … 99-full-page.png        ảnh theo từng bước
steps.js                               kịch bản, sửa được rồi quay lại
user-search-console.log                chỉ có khi trang bị lỗi
```

Timeline nằm trong runbook chứ không nhúng vào video — sửa câu chữ không phải quay lại.

Video và ảnh **không commit** vào Git. Tự tải lên MR/PR.

## Lần đầu ở một dự án mới

Cần một file `evidence.config.js` mô tả: app chạy ở URL nào, cách dựng môi trường, cách đăng nhập.

```
/get-evidence dựng config evidence cho dự án này
```

Claude sẽ dò màn đăng nhập, tìm tài khoản dev, viết file đó. Từ lần sau chỉ cần `/get-evidence`.

Đặt file ở thư mục evidence chung của dự án. Issue nào cần khác biệt riêng thì thêm một
`evidence.config.js` ngay trong thư mục của issue đó — nó được ưu tiên.

## Chỉnh theo ý mình

Trong `evidence.config.js` của dự án:

```js
recording: {
  speed: 'slow',        // như tốc độ phát video: 'fast' | 'normal' | 'slow' | 'slowest', hoặc số
},
output: {
  overwrite: false,     // false: bản quay cũ được giữ lại trong evidence/v1, v2…
},
```

Còn nhiều thứ chỉnh được nữa (khung hình, chất lượng video, thời gian chờ của từng loại thao tác) —
bảo Claude "chỉnh <cái bạn muốn> cho evidence" là nó biết chỗ sửa.

## Cần sẵn trên máy

- Google Chrome
- ffmpeg
- Node.js

## Giới hạn

Video quay nội dung trang chứ không quay màn hình máy, nên những hộp thoại do hệ điều hành vẽ
không lọt vào: menu của `<select>`, hộp chọn file, `confirm`/`alert` của trình duyệt.

Bù lại, những chỗ đó có **câu chú thích hiện trong video** nói rõ vừa chọn gì và vì sao không thấy
widget — kèm ảnh chụp trạng thái sau khi chọn để chứng minh kết quả. Trước khi quay, Claude hỏi bạn
có bật chú thích không và viết bằng ngôn ngữ nào (mặc định English; khách Nhật thì chọn 日本語).
Muốn cố định cho cả dự án thì đặt trong `evidence.config.js`:

```js
recording: {
  captions: { enabled: true, locale: 'ja' },   // en | ja | vi
},
```

Modal, datepicker, dropdown dựng bằng JS thì quay bình thường.

Thao tác bằng bàn phím cũng không thấy được trên hình — bù lại, mỗi phím tắt trong kịch bản hiện
một bảng chú thích (`⌘ + C`, kèm câu mô tả) ngay cạnh chỗ đang thao tác, và được liệt kê lại kèm
mốc thời gian trong runbook.

## Chạy tay (không qua Claude)

`$SKILL` là thư mục chứa skill: `~/.claude/skills/get-evidence` (dùng chung mọi dự án) hoặc
`.claude/skills/get-evidence` (nằm trong dự án).

Chạy **từ thư mục dự án**, không `cd` vào thư mục skill — runner từ chối chạy khi thư mục làm việc
nằm trong đó, để kết quả không rơi vào tài sản dùng chung.

```bash
SKILL=~/.claude/skills/get-evidence

# xem tham số
node $SKILL/lib/record.js --help
node $SKILL/lib/inspect.js --help

# liệt kê phần tử của một màn để viết kịch bản
node $SKILL/lib/inspect.js /duong-dan-man-hinh

# quay
OUT_DIR=<thư mục lưu> node $SKILL/lib/record.js <đường-dẫn>/steps.js
```
