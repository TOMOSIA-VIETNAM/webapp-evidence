---
name: get-evidence
description: Capture evidence (operation video + screenshots + timeline) to attach to a pull/merge request. Use whenever the user says "get evidence", "lấy evidence", "quay evidence", "chụp màn hình cho MR/PR", asks for proof or a recording of a change, or hands over an MR/PR link and wants evidence for it — including right after finishing a task or bug fix in the same session, when the screen and flow are already known from context.
---

# get-evidence

Quay evidence để đính lên MR/PR: video thao tác (mp4) + screenshot + runbook mô tả từng khoảng thời
gian trong video và cách chạy lại. Chạy trên môi trường dev local của dự án.

Skill này không biết gì về app cụ thể. Mọi thứ riêng của dự án — URL, cách dựng môi trường, cách
đăng nhập — nằm trong `evidence.config.js` (mẫu:
`$SKILL/templates/evidence.config.example.js`). Chưa có file đó thì tạo trước, dựa trên mẫu, rồi
mới quay.

Chỗ đặt cấu hình quyết định phạm vi áp dụng, tìm từ gần đến xa:

1. `EVIDENCE_CONFIG=<đường dẫn>` — chỉ định thẳng
2. `evidence.config.js` **cạnh kịch bản** — cấu hình riêng của một issue (thường `require` cấu hình
   chung rồi ghi đè vài chỗ)
3. Leo dần lên thư mục cha, mỗi cấp tìm `evidence.config.js` hoặc `evidence/evidence.config.js` —
   đây là chỗ đặt cấu hình chung của dự án
4. `<gốc dự án>/.claude/evidence.config.js`
5. Quét nông trong repo nếu vẫn chưa thấy; có nhiều file thì báo lỗi và bắt chỉ rõ

Trong tài liệu này `$SKILL` là thư mục chứa chính file SKILL.md — `.claude/skills/get-evidence`
khi skill nằm trong dự án, hoặc `~/.claude/skills/get-evidence` khi cài chung cho mọi dự án. Đặt
biến cho gọn rồi dùng lại trong các lệnh bên dưới:

```bash
SKILL=~/.claude/skills/get-evidence   # hoặc .claude/skills/get-evidence
```

## 1. Lần đầu ở một dự án mới

Chưa có `evidence.config.js` thì dựng nó trước — đây là toàn bộ phần skill không tự biết được.
Làm theo thứ tự này để không rơi vào cảnh phải đoán:

1. **Tìm URL dev và cách khởi động app** — đọc README, `docker-compose.yml`, `package.json`
   (scripts), `Procfile`. Ghi lại lệnh start và cổng.
2. **Tạo cấu hình tối thiểu** từ `$SKILL/templates/evidence.config.example.js`: chỉ `baseUrl`,
   chưa cần `login` và `prepare`. Đặt ở thư mục evidence chung của dự án.
3. **Dò màn đăng nhập**: `node $SKILL/lib/inspect.js /duong-dan-login` — lấy selector thật của ô
   email/mật khẩu và nút submit thay vì đoán tên field.
4. **Tìm nguồn tài khoản dev**: seed, fixtures, hoặc bản ghi sẵn có trong DB. Ưu tiên cách skill tự
   lấy được (truy vấn DB, đặt lại mật khẩu cho một tài khoản có sẵn) để những lần sau không phải hỏi
   ai. Không tự lấy được thì hỏi user một lần rồi lưu vào `accountStore`.
5. **Viết `login()`** trong cấu hình, dùng selector vừa dò. Nếu app có bước xác thực phụ (mã OTP,
   thiết bị lạ), xử lý luôn ở đây — đọc mã từ DB thường nhanh và ổn định hơn đọc hộp thư.
6. **Viết `prepare()`** nếu môi trường hay lệch (container chưa chạy, thiếu dependency, cần
   migrate). Trả về danh sách những gì đã sửa để runner in cho người dùng.
7. **Kiểm chứng**: `node $SKILL/lib/inspect.js /mot-man-sau-dang-nhap` — ra được danh sách phần tử
   nghĩa là cấu hình và đăng nhập đã chạy. Giờ mới viết kịch bản và quay.

Bước 3 và 7 là hai lần dùng `inspect.js` khác mục đích: một lần để **viết** phần đăng nhập, một lần
để **xác nhận** nó hoạt động.

## 2. Không ghi gì vào thư mục skill

`$SKILL` là tài sản dùng chung cho mọi dự án. Mọi thứ sinh ra khi quay — cấu hình, tài khoản, kịch
bản, kết quả, và cả file thử nghiệm tạm — đều thuộc về dự án đang làm, không được nằm trong đó. Rác
để lại ở thư mục skill sẽ theo sang mọi dự án khác dùng chung bản cài.

Cạm bẫy hay gặp: cần chạy một đoạn Playwright rời để thử, thấy `node_modules` nằm sẵn trong
`$SKILL/lib` nên đặt file ngay đó cho `require` chạy được. Cách đúng là để file trong dự án và trỏ
`NODE_PATH` về đó:

```bash
NODE_PATH=$SKILL/lib/node_modules node <thư mục dự án>/thu-nghiem.js
```

Nhưng trước khi viết script rời, cân nhắc `inspect.js` đã đủ chưa — phần lớn nhu cầu "xem trang có
gì, selector nào" đã nằm ở đó.

Runner từ chối chạy nếu thư mục làm việc, `OUT_DIR` hoặc kịch bản nằm trong thư mục skill, nên lỗi
này lộ ra ngay thay vì âm thầm tích rác.

## 3. Xác định ngữ cảnh trước khi quay

Cần 4 thứ: **app**, **mã issue** (để đặt tên thư mục lưu), **URL màn hình**, **flow cần chứng
minh**.

| Tình huống | Lấy ngữ cảnh từ đâu |
|---|---|
| User gõ "get evidence" ngay trong phiên vừa code | Lấy từ chính cuộc hội thoại: task vừa làm, màn hình/endpoint vừa sửa. Không hỏi lại thứ đã biết |
| Session mới, user đưa link MR/PR | Đọc MR/PR (mô tả + diff) để suy ra màn hình và flow |
| Thiếu app, hoặc không suy được màn hình/flow | Hỏi user bằng `AskUserQuestion`, mỗi câu kèm option có đề xuất |

Flow phải bám đúng thứ MR thay đổi. Quay lan sang màn khác chỉ làm video dài mà không chứng minh
thêm điều gì.

## 4. Chọn loại evidence

| Thay đổi | Evidence |
|---|---|
| Màn tĩnh, chỉ đổi hiển thị, 1–2 thao tác | Screenshot là đủ |
| Flow nhiều bước (nhập liệu, submit, modal, chuyển màn) | Video + screenshot ở các mốc chính |
| Không quay được vì lý do kỹ thuật | Tối thiểu phải có screenshot, và nói rõ lý do trong report |

## 5. Dò selector rồi mới viết kịch bản

Đừng đoán selector từ trí nhớ hay từ việc đọc template — màn hình thật mới là nguồn đúng, nhất là
khi giao diện dựng bằng JS. Mở màn hình và lấy danh sách phần tử tương tác trước:

```bash
# Cài dependency của runner (chỉ lần đầu)
[ -d $SKILL/lib/node_modules ] || npm install --prefix $SKILL/lib --no-audit --no-fund

node $SKILL/lib/inspect.js /duong-dan-man-hinh
```

Kết quả in ra nút / ô nhập / select (kèm danh sách lựa chọn thật) / liên kết, mỗi dòng là một
selector dùng được ngay. Menu điều hướng chung bị lọc bỏ cho gọn (`--all` để xem hết).

## 6. Chọn chỗ lưu kết quả

Kết quả quay là file nặng và sinh lại được, nên nó thuộc về vùng tạm của dự án chứ không thuộc lịch
sử repo. Tìm chỗ lưu theo thứ tự từ gần đến xa, dừng ở cái đầu tiên khớp:

1. **Người dùng đã chỉ định** — tôn trọng tuyệt đối, không bàn thêm.
2. **Issue đã có thư mục riêng** (`backlogs/<issue>/`, `notebooks/<issue>/`, hay bất cứ thư mục nào
   phiên làm việc đang dùng cho chính issue đó) → ghi vào thư mục con `evidence/` bên trong nó. Một
   issue chỉ nên có một cây thư mục; đẻ thêm nhánh thứ hai cho cùng một việc khiến người sau phải
   tìm ở hai nơi.
3. **Dự án có sẵn thư mục tạm đã ignore** mà các công cụ khác vẫn ghi vào (thường là `notebooks/`)
   → `<thư mục đó>/evidence/<issue>/`.
4. **Không có gì để bám** → hỏi người dùng, kèm đề xuất cụ thể. Đừng tự dựng cây thư mục mới trong
   repo của họ.

Hai ràng buộc phải giữ:

- **Kết quả nằm trong tầm nhìn từ chỗ người dùng đang đứng.** Họ gọi skill từ `code/` mà kết quả rơi
  lên thư mục cha thì coi như mất — đừng leo lên trên thư mục làm việc của họ.
- **Không sửa `.gitignore`.** Chỗ lưu phải là vùng dự án *vốn đã* ignore. Tự thêm một dòng ignore
  rồi coi như đã thoả điều kiện là lách luật: đó là sửa repo người khác cho một việc phụ trợ.

Thư mục issue ở bước 2 thường **untracked chứ chưa ignore** — người ta muốn commit phần ghi chú
trong đó, chỉ riêng video/ảnh là không. Untracked nghe thì có vẻ đủ, nhưng `git add -A` nuốt sạch
file untracked, và video đã vào commit thì phải viết lại lịch sử mới gỡ ra được. Nên vẫn phải là
ignore thật.

Runner kiểm và dừng nếu chưa ignore, kèm sẵn dòng cần thêm — việc của bạn là chuyển câu đó cho
người dùng, chờ họ thêm, rồi chạy lại:

```
Nhờ người dùng thêm một trong các dòng sau vào .gitignore rồi chạy lại:
  backlogs/1599-uat23/evidence/pr1606/
  backlogs/**/evidence/
```

Dòng thứ hai là pattern gọn cho mọi issue về sau, thường là thứ người dùng muốn. Họ cân nhắc rồi vẫn
muốn ghi vào vùng chưa ignore thì chạy lại với `EVIDENCE_ALLOW_TRACKED=1` — quyết định đó thuộc về
họ, không thuộc về skill.

Riêng `accountStore` thì không có cửa thoát: nó chứa mật khẩu và nằm lại lâu dài, nên bắt buộc phải
ở vùng đã ignore.

## 7. Cấu hình nhịp quay và cách giữ bản cũ

`evidence.config.js` chia theo scope để về sau thêm nhóm mới mà không đụng nhóm cũ:

| Scope | Chứa gì |
|---|---|
| `apps` | mỗi app: `baseUrl`, `prepare`, `login` |
| `recording` | khung hình, ngôn ngữ, trình duyệt, **tốc độ thao tác**, chú thích, chất lượng video |
| `output` | kết quả xử lý ra sao: `overwrite`, `accountStore` |

Khoá nào không khai thì dùng mặc định của skill (`lib/settings.js` là nơi liệt kê đủ).

**Tốc độ** chỉnh bằng `recording.speed`, hiểu đúng như tốc độ phát của trình xem video: **số lớn
hơn là nhanh hơn**.

| Giá trị | Nghĩa |
|---|---|
| `'slowest'` | 0.5× — chậm một nửa |
| `'slow'` | 0.67× |
| `'normal'` | 1× (mặc định) |
| `'fast'` | 1.67× |
| số bất kỳ trong `0.2`–`5` | mức riêng, ví dụ `0.8` chậm hơn bình thường một chút |

Đây là khoá dành cho phản hồi thực tế của người xem — họ nói "nhanh quá" chứ không nói "tăng
afterClickMs lên 1200". Số ngoài khoảng cho phép bị từ chối kèm giải thích, để một lần gõ nhầm
không biến bản quay thành cả tiếng đồng hồ.

Bên dưới nó là `recording.pace` với từng quãng thời gian riêng (chờ sau khi bấm, tốc độ gõ phím,
giữ ảnh cuối…). Chỉ đụng tới khi một thao tác cụ thể cần khác phần còn lại; giá trị khai ở đây là
tuyệt đối, không bị `speed` nhân thêm. Danh sách đầy đủ ở `lib/settings.js`.

Đừng chỉnh nhịp bằng cách rải `sleep()` trong kịch bản — nhịp là thuộc tính của cả bản quay, để ở
một chỗ thì lần sau chỉnh một lần là xong.

Ba thứ trong `pace` được tính chứ không cố định, để bản quay không ra nhịp máy:

| Thứ | Cách nó chạy |
|---|---|
| Quãng chờ | Rung quanh giá trị khai theo `pace.jitter` (mặc định `0.18`). Nhịp đều tăm tắp là dấu hiệu rõ nhất của video do máy bấm. Đặt `0` khi cần hai bản quay khớp từng khung |
| Thời gian di chuyển con trỏ | Tính theo khoảng cách và độ lớn của đích (`cursorBaseMs`, `cursorPerBitMs`, chặn trong `cursorMinMs`–`cursorMaxMs`). Rê sang ô bên cạnh mất ~0.4s, vượt cả màn hình mất ~0.8s. Đi xa thì con trỏ vượt qua đích một chút rồi chỉnh lại |
| Tốc độ gõ | `typeCharMs` là mức trung bình, từng ký tự lệch quanh đó; chậm lại ở dấu cách và sau dấu câu |

Ngẫu nhiên có hạt giống cố định theo tên kịch bản, nên cùng một kịch bản cho ra cùng một nhịp ở mọi
lần quay — runbook vẫn chạy lại được đúng bản quay.

**Chú thích** ở `recording.captions`:

```js
recording: {
  captions: { enabled: true, locale: 'ja' },   // locale: en | ja | vi
},
```

Đặt ở cấu hình chung khi cả dự án luôn dùng một ngôn ngữ (khách Nhật thì `'ja'`), để mỗi lần quay
không phải hỏi lại. `CAPTIONS` / `CAPTION_LOCALE` trên dòng lệnh thắng cấu hình — đó là quyết định
của người đang chạy.

**Bản quay cũ không bị ghi đè.** `output.overwrite` mặc định `false`: trước khi quay, kết quả lần
trước được dồn vào `v1`, `v2`… ngay trong thư mục evidence, rồi bản mới ghi vào thư mục gốc. Lý do
là evidence đã gửi kèm MR — ghi đè thì mất luôn cái để đối chiếu khi có tranh cãi về hành vi cũ.
Kịch bản, fixture và cấu hình không phải kết quả nên vẫn nằm nguyên chỗ.

Chỉ cần bản mới nhất thì đặt `output.overwrite: true`, hoặc chạy một lần với
`EVIDENCE_OVERWRITE=1`.

## 8. Chốt chú thích trước khi quay

Bản quay không chứa được menu `<select>` và hộp chọn file (mục 『Giới hạn kỹ thuật cần biết』).
Chú thích trong video lấp chỗ đó bằng một câu nói rõ vừa chọn gì và vì sao không thấy widget.
Nhưng nó là chữ đè lên màn hình app, và ngôn ngữ phải khớp người review — nên hỏi, đừng tự quyết.

Hỏi bằng `AskUserQuestion`, hai câu một lượt:

| Câu | Option |
|---|---|
| Có hiện chú thích trong video không? | Bật (đề xuất) / Tắt |
| Ngôn ngữ chú thích? | English (mặc định) / 日本語 / Tiếng Việt |

Rồi truyền vào lệnh quay: `CAPTIONS=on|off`, `CAPTION_LOCALE=en|ja|vi`.

**Không hỏi** khi đã có câu trả lời: user nói sẵn trong hội thoại ("quay kèm chú thích tiếng
Nhật"), hoặc `evidence.config.js` đã đặt `recording.captions` — cấu hình là quyết định đã chốt của
dự án.

Ngôn ngữ chú thích là ngôn ngữ **người review MR đọc**, không phải ngôn ngữ giao diện app. Cùng
tiêu chí với `mark()` và `label` của `hotkey()`.

## 9. Quay

```bash
OUT_DIR=<thư mục evidence của issue> \
  CAPTIONS=on CAPTION_LOCALE=ja \
  node $SKILL/lib/record.js <đường dẫn steps.js>
```

Runner tự dựng môi trường (qua `prepare` trong config), tự đăng nhập (qua `login`), quay, cắt phần
chờ load ở đầu, xuất mp4 + runbook. Mỗi thứ nó sửa được in ra ở dòng `FIXED: …` — đưa nguyên các
dòng đó vào report.

Cả hai script đều có `--help` liệt kê tham số và biến môi trường. Gọi `--help` khi cần thay vì đọc
mã nguồn — chúng được viết để dùng như hộp đen, đọc vào chỉ tốn context.

Tài khoản đăng nhập do config lo và được nhớ lại ở `accountStore`, nên từ lần thứ hai không phải hỏi
người dùng gì nữa. Bước đăng nhập không nằm trong video.

## 10. Quay lại một evidence đã có

Mỗi bản quay để lại `<name>-runbook.md` chính là để việc này không tốn công dò lại:

| Tình huống | Làm gì |
|---|---|
| Quay lại y nguyên (dữ liệu đổi, video cũ hỏng, cần bản mới cho MR khác) | Mở runbook, chạy đúng lệnh trong mục "Chạy lại" |
| Đổi vài bước (thêm thao tác, đổi nhịp, đổi lời trong timeline) | Sửa `steps.js`, chạy lại lệnh cũ |
| Selector gãy vì UI đã đổi | `inspect.js` lại màn đó, sửa selector trong `steps.js`, chạy lại |

Bản cũ được dồn vào `v1`, `v2`… trước khi quay (mục 『Cấu hình nhịp quay và cách giữ bản cũ』), nên
chạy lại không mất gì và cũng không lẫn ảnh của lần trước khi số bước thay đổi.

## 11. Viết kịch bản `steps.js`

Module trả về `{ app, name, start, run(ctx) }` — mẫu đầy đủ ở `$SKILL/templates/steps.example.js`.
Trong `run` dùng các helper của `ctx`:

| Helper | Dùng để |
|---|---|
| `mark('mục đích')` | Đánh dấu một khoảng trong timeline. Đặt theo **mục đích** (một cụm thao tác), không phải từng click |
| `click(locator, { pause })` | Di chuột có quán tính tới phần tử rồi bấm (kèm hiệu ứng ripple). `pause` là quãng dừng sau khi bấm: `'quick'` / `'normal'` / `'observe'` hoặc số ms |
| `type(locator, text)` | Bấm vào ô rồi gõ từng ký tự |
| `select(locator, 'nhãn')` | Mở danh sách của `<select>` ngay trong trang rồi bấm chọn |
| `upload(locator, path)` | Nạp file vào ô file rồi dừng để thấy tên file hiện lên |
| `hotkey('ControlOrMeta+C', { label, target })` | Bấm phím tắt, kèm bảng chú thích phím hiện trong video |
| `note('câu chú thích')` | Hiện một câu chú thích trong video, neo cạnh phần tử liên quan |
| `shot('tên')` | Chụp screenshot, tự đánh số theo thứ tự |
| `page`, `sleep(ms)` | Locator/chờ khi cần thao tác đặc thù |

**Mọi thao tác phải đi qua helper.** Gọi thẳng API của Playwright (`locator.click()`,
`locator.fill()`, `locator.setInputFiles()`) vẫn chạy đúng và test vẫn xanh, nhưng con trỏ không
di chuyển tới đó — người xem thấy giá trị tự nhảy vào ô mà không hiểu ai bấm. Đây là lỗi hay gặp
nhất khi viết kịch bản, và nó chỉ lộ ra khi xem lại video.

| Đừng viết | Viết |
|---|---|
| `locator.click()` | `click(locator)` |
| `locator.fill(text)` | `type(locator, text)` |
| `locator.selectOption(...)` | `select(locator, 'nhãn')` |
| `locator.setInputFiles(path)` | `upload(locator, path)` |
| `page.keyboard.press('Meta+C')` | `hotkey('ControlOrMeta+C', { label: 'コピー' })` |

Nhịp mặc định của helper đã canh cho người xem theo kịp. Khi cần chỉnh: modal/dialog giữ tối thiểu
4s trước khi đóng. Ngôn ngữ của `mark()` viết theo ngôn ngữ mà người review MR đọc.

### Chọn quãng dừng sau mỗi click

Không phải cú click nào cũng có thứ để xem. Người thật bấm liền tay qua những bước dẫn đường, chỉ
dừng lại khi có kết quả hiện ra để đọc. Nói ý đó bằng mức `pause`, đừng rải số ms:

| `pause` | Dùng khi | Mặc định |
|---|---|---|
| `'quick'` | Click chỉ để đi tiếp: mở tab, bung menu, đưa con trỏ vào ô trước khi gõ | `pace.afterClickQuickMs` (220ms) |
| bỏ trống | Thao tác bình thường, màn hình có đổi nhưng không cần đọc kỹ | `pace.afterClickMs` (800ms) |
| `'observe'` | Kết quả phải đọc được: submit xong hiện danh sách, mở modal, báo lỗi validate | `pace.afterClickObserveMs` (1700ms) |
| số ms | Trường hợp riêng, ví dụ chờ animation dài của một widget cụ thể | — |

```js
mark('Lọc theo trạng thái rồi tìm');
await click(page.getByRole('tab', { name: '検索条件' }), { pause: 'quick' });
await select(page.locator('#q_status_eq'), 'Active');
await click(page.getByRole('button', { name: '検索' }), { pause: 'observe' });
await shot('result');
```

Kèm theo `shot()` gần như luôn đi với `'observe'`: đã cần chụp lại thì người xem cũng cần thời gian
nhìn.

### Chú thích trong video

`select()` và `upload()` **tự** hiện chú thích (menu và hộp thoại của chúng do hệ điều hành vẽ,
không quay được) — kịch bản không phải làm gì. Câu chữ nằm ở `lib/captions.js`, một chỗ duy nhất.

`note()` là để tự viết, cho những chỗ chỉ người viết kịch bản mới biết là cần nói ra:

```js
await note('この行はシードデータで、この操作で作られたものではありません。', {
  target: page.locator('#row_12'),
});
```

| Dùng `note()` cho | Ví dụ |
|---|---|
| Dữ liệu có sẵn, không do flow này tạo | "bản ghi này từ seed, không phải kết quả của thao tác vừa rồi" |
| Lỗi/trạng thái là **đúng như mong đợi** | "server trả 422 vì đang quay màn kiểm tra dữ liệu sai" |
| Thao tác bị hệ điều hành che mà helper không tự biết | `confirm()` của trình duyệt vừa bị chấp nhận |

Chú thích **tắt theo công tắc chung**: chạy với `CAPTIONS=off` thì cả chú thích tự động và
`note()` đều không hiện, không có ngoại lệ. Một công tắc, một kết quả đoán được.

Đừng dùng `note()` để thuyết minh thứ đã thấy rõ trên hình. Mỗi câu chú thích là chữ che một
phần màn hình app — chỉ đáng che khi nó nói được điều bản quay không nói được.

### Thao tác bằng bàn phím

Phím tắt (`Cmd/Ctrl + C/V/X`, `Escape`, `Enter`…) không để lại dấu vết nào trên hình: chuột đứng
im, không có ripple, người xem chỉ thấy nội dung tự đổi và không biết vì sao. Nên mọi lần bấm phím
đều đi qua `hotkey()` — nó hiện một bảng chú thích phím ngay cạnh phần tử đang thao tác, giữ đủ lâu
để đọc được cả phím và kết quả, rồi tắt.

```js
mark('Sao chép mã người dùng rồi dán sang ô tìm kiếm');
await hotkey('ControlOrMeta+C', { label: 'コピー', target: page.locator('#user_code') });
await hotkey('ControlOrMeta+V', { label: '貼り付け', target: page.locator('#q_keyword') });
```

| Tham số | Nghĩa |
|---|---|
| `keys` | Chuỗi phím của Playwright: `'ControlOrMeta+C'`, `'Shift+Tab'`, `'Escape'`. Dùng `ControlOrMeta` để kịch bản chạy được trên cả macOS và Windows/Linux |
| `label` | Chú thích việc đang làm, hiện cạnh phím. Viết theo ngôn ngữ người review MR đọc, như `mark()` |
| `target` | Phần tử phím tắt tác động lên. Có thì helper bấm vào đó trước (người xem thấy phạm vi áp dụng) và neo bảng vào đúng phần tử đó |
| `pause`, `hold` | Ghi đè `pace.afterHotkeyMs` / `pace.hotkeyHoldMs` cho riêng lần này |

Bảng chú thích tự tránh che thứ đang được chứng minh: đặt dưới phần tử, hết chỗ thì lên trên, rồi
sang cạnh bên. Không `target` thì nó neo theo vùng văn bản đang chọn (đúng thứ mà `Cmd+C` tác
động), rồi tới phần tử đang giữ focus, cuối cùng mới rơi về giữa đáy khung hình.

Ký hiệu phím hiển thị theo hệ điều hành đang quay: máy Mac ra `⌘ + C`, máy Windows/Linux ra
`Ctrl + C`.

**Phím tắt không phải cách để đi tắt.** Đóng modal, submit form, mở menu — nếu UI có nút thật thì
bấm nút bằng `click()`, vì người xem cần thấy nút nào được bấm. Chỉ dùng `hotkey()` khi chính phím
tắt là thứ MR cần chứng minh, hoặc khi không có cách nào khác trên UI.

## 12. Giới hạn kỹ thuật cần biết

Video quay **nội dung trang**, không quay màn hình máy. Hệ quả:

- **`<select>`**: menu bung ra là widget do hệ điều hành vẽ nên không lọt vào khung hình. Helper
  `select()` bấm vào ô rồi đổi lựa chọn bằng phím mũi tên (người xem thấy giá trị trong ô chạy
  dần), chốt lại bằng dữ liệu để chắc chắn chọn đúng, và hiện chú thích nói rõ vừa chọn gì. Không
  vẽ lại menu giả: mọi cách vẽ lại đều phải sửa style của element thật, làm bố cục trong video
  khác bố cục app thật — evidence mất giá trị.
- **Hộp thoại chọn file của hệ điều hành**: không quay được. Helper `upload()` nạp file, dừng đủ
  lâu để tên file hiện lên trong ô, và hiện chú thích nói rõ đã chọn file nào. Thứ chứng minh được
  là kết quả sau khi chọn, không phải hộp thoại.
- **Hộp thoại `confirm`/`alert` của trình duyệt**: cũng do hệ điều hành vẽ. Nếu flow phụ thuộc vào
  chúng, chụp thêm ảnh trạng thái trước/sau và nói rõ trong report.
- **Bàn phím**: không có gì trên hình cho thấy phím nào được bấm. Helper `hotkey()` bù bằng bảng
  chú thích phím trong video, và liệt kê lại kèm mốc thời gian trong runbook.

Widget dựng bằng JS (modal, datepicker, dropdown của UI kit) thì quay được đầy đủ.

Nếu flow tạo dữ liệu thật trong DB dev (submit form tạo bản ghi), nêu rõ trong report để người khác
biết dữ liệu đó từ đâu ra.

## 13. Output và report

Trong thư mục `OUT_DIR`:

| File | Nội dung |
|---|---|
| `<name>.mp4` | video thao tác |
| `<name>-runbook.md` | mọi thứ để đọc lại và chạy lại: app, URL, đường dẫn cấu hình/kịch bản, lệnh re-run, **timeline các bước**, phím tắt đã bấm và chú thích đã hiện, kèm mốc thời gian (chỉ khi có), danh sách ảnh, môi trường đã sửa, lỗi trang ghi nhận |
| `NN-*.png` | screenshot đánh số theo thứ tự chụp |
| `<name>-console.log` | **chỉ sinh khi trang có lỗi** — console error/warning và request ≥400 |
| `steps.js` | kịch bản, để lần sau chạy lại không phải dò màn hình từ đầu |

Runbook là thứ để quay lại sau này mà không mất công dò lại: mở nó ra, chạy đúng lệnh trong đó.
Muốn đổi nội dung quay thì sửa `steps.js`, không sửa runbook (nó được sinh lại mỗi lần quay).

Thư mục này nằm trong vùng dự án đã ignore sẵn (cách chọn ở mục 『Chọn chỗ lưu kết quả』) —
**không commit** video/ảnh; user tự attach lên MR/PR.

Trước khi quay, nếu có kết quả lần trước phải dồn đi, runner in `ARCHIVED: bản quay trước chuyển
vào <đường dẫn v{N}>`. Chạy xong nó in tiếp phần dưới — chuyển nguyên cho người dùng, đừng tóm tắt
lại thành "đã quay xong":

```
VIDEO:   notebooks/spec/ISSUE-421/evidence/user-search.mp4  (39.3s, 527 KB)
RUNBOOK: notebooks/spec/ISSUE-421/evidence/user-search-runbook.md
ẢNH:     8 tấm trong notebooks/spec/ISSUE-421/evidence

BẢN CŨ:  v1 (1.2 MB), v2 (1.1 MB)
  Không cần đối chiếu nữa thì xoá: rm -rf .../v1 .../v2
```

Họ cần đường dẫn chính xác để mở xem rồi kéo lên MR, nên đừng bắt họ đi tìm.

Có dòng `BẢN CŨ` thì hỏi luôn xem còn cần giữ không, và để người dùng quyết — đừng tự xoá.

Report cuối cho user bổ sung thêm: nội dung timeline, những gì runner đã tự sửa ở môi trường, và
giới hạn đã gặp (nếu có).

Có dòng `PROBLEMS:` thì đọc file console log rồi mới kết luận, và phân biệt ba loại: kịch bản gãy vì
selector sai, app đang lỗi thật, hay lỗi **có chủ ý** của chính kịch bản (quay màn kiểm tra dữ liệu
sai thì server trả 4xx là đúng như mong đợi). Loại thứ ba nói rõ trong report để không ai tưởng là
bug.

## 14. Không làm

- Không commit, không push, không tự attach lên MR/PR.
- Không ghi mật khẩu vào report hay vào bất kỳ file nào ngoài `accountStore`.
- Không tạo, sửa hay để lại file nào trong thư mục skill.
- Không sửa `.gitignore` của dự án, kể cả để hợp thức hoá chỗ lưu evidence.
- Không dựng cây thư mục mới cho một issue đã có thư mục riêng.
- Không tự xoá các bản quay cũ (`v1`, `v2`…) — đề xuất cho người dùng rồi để họ quyết.
- Không đụng môi trường staging/production — chỉ dev local.
- Không nhúng phụ đề vào video; phần giải thích nằm ở file timeline để sửa được mà không phải quay
  lại.
