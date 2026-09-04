// Nhịp thao tác giống người thật: đường đi con trỏ, quãng chờ, tốc độ gõ.
//
// Máy thao tác đều tăm tắp — mỗi cú click cách nhau đúng 800ms, con trỏ đi đường thẳng hết
// 312ms bất kể xa gần. Người xem không gọi tên được cái sai đó, chỉ thấy video "máy quay".
// Ba thứ tạo ra khác biệt, theo thứ tự dễ thấy:
//   1. Quãng chờ không đều — mỗi lần lệch nhau một chút.
//   2. Thời gian di chuyển phụ thuộc khoảng cách và độ lớn của đích (định luật Fitts).
//   3. Đường đi hơi cong, tăng tốc nhanh rồi hãm dần, đi xa thì vượt qua đích một chút rồi
//      chỉnh lại — đúng cách tay người điều khiển chuột.
//
// Ngẫu nhiên ở đây có hạt giống cố định theo tên kịch bản: cùng một kịch bản thì nhịp lệch
// giống nhau ở mọi lần quay, nên runbook vẫn giữ được lời hứa "chạy lại ra đúng bản này".

// mulberry32: đủ tốt cho việc rung nhịp, và quan trọng hơn là tái lập được.
function createRng(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(text) {
  let hash = 2166136261;
  for (let i = 0; i < String(text).length; i++) {
    hash ^= String(text).charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

// Vận tốc của một cú với chuột: bung nhanh trong khoảng 1/5 đầu thời gian rồi hãm dần suốt
// phần còn lại. Đối xứng (nhanh dần rồi chậm dần đều nhau) là nhịp của máy, không phải của tay.
const ACCEL_T = 0.22;   // phần thời gian dành cho pha bung
const ACCEL_D = 0.18;   // phần khoảng cách đi được trong pha đó
function ballistic(t) {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  if (t < ACCEL_T) return ACCEL_D * (t / ACCEL_T) ** 2;
  return ACCEL_D + (1 - ACCEL_D) * (1 - (1 - (t - ACCEL_T) / (1 - ACCEL_T)) ** 2.4);
}

function createHuman({ pace, viewport, seed }) {
  const rng = createRng(hashSeed(seed || 'evidence'));
  const jitterRatio = Math.max(0, Math.min(pace.jitter ?? 0, 0.6));

  const between = (min, max) => min + rng() * (max - min);

  // Quãng chờ lệch nhau một chút quanh giá trị cấu hình. `jitter: 0` thì tắt hẳn, dùng khi
  // cần đối chiếu hai bản quay khung-trên-khung.
  const wait = (ms) => {
    if (!ms || !jitterRatio) return Math.round(ms || 0);
    return Math.max(0, Math.round(ms * (1 + between(-jitterRatio, jitterRatio))));
  };

  // Định luật Fitts: đích càng nhỏ và càng xa thì tay càng phải đi lâu. Đây là lý do một cú
  // rê 40px sang ô bên cạnh không thể mất cùng thời gian với cú vượt 900px sang góc màn hình.
  const moveDuration = (dist, targetSize) => {
    if (dist < 4) return 0;
    const width = Math.max(16, Math.min(targetSize || 40, 220));
    const bits = Math.log2((2 * dist) / width + 1);
    const raw = pace.cursorBaseMs + pace.cursorPerBitMs * bits;
    return Math.round(Math.max(pace.cursorMinMs, Math.min(raw, pace.cursorMaxMs)) * (1 + between(-0.12, 0.12)));
  };

  // Kế hoạch cho một cú di chuyển: tổng thời gian và vị trí con trỏ tại từng mốc t (0 → 1).
  //
  // Trả về hàm vị trí chứ không trả về danh sách khung hình, vì mỗi lệnh page.mouse.move mất
  // khoảng 17ms đi về trình duyệt — nhiều hơn cả khoảng giữa hai khung hình. Bơm một danh sách
  // cố định thì cú di chuyển nào cũng dài hơn ý định, và `speed` mất tác dụng lên con trỏ.
  // Bên gọi nội suy theo đồng hồ thật: máy chậm thì được ít khung hình hơn, còn thời lượng và
  // hình dáng đường đi vẫn đúng.
  const movePlan = (from, to, targetSize) => {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 1) return null;

    const moveMs = Math.max(moveDuration(dist, targetSize), pace.cursorFrameMs);

    // Tay không đi thẳng: quỹ đạo phình ra một bên, đi càng xa phình càng rõ nhưng có trần
    // để không thành đường vòng kỳ dị.
    const arc = Math.min(dist * 0.06, 34) * between(0.4, 1) * (rng() < 0.5 ? -1 : 1);
    const nx = -dy / dist;
    const ny = dx / dist;

    // Đi xa thì mắt bắt đích trễ hơn tay: chuột vượt qua đích vài pixel rồi mới chỉnh lại.
    // Cú chỉnh lại đó là chi tiết mà người xem nhận ra ngay là "có người đang điều khiển".
    const overshoot = dist > 260 ? between(5, 13) : 0;
    const aimX = to.x + (dx / dist) * overshoot;
    const aimY = to.y + (dy / dist) * overshoot;

    const settleMs = overshoot ? pace.cursorSettleMs : 0;
    const duration = moveMs + settleMs;
    const split = moveMs / duration;

    // Rung tay dưới một pixel. Bảng cố định thay vì gọi rng() trong hàm vị trí: cùng một t
    // phải luôn ra cùng một chỗ, nếu không đường đi rung theo số khung hình máy chạy được.
    const noise = Array.from({ length: 24 }, () => ({ x: between(-0.4, 0.4), y: between(-0.4, 0.4) }));

    const at = (t) => {
      const clamped = Math.max(0, Math.min(t, 1));
      if (clamped >= 1) return { x: to.x, y: to.y };

      const shake = noise[Math.floor(clamped * (noise.length - 1))];
      if (clamped >= split) {
        // Pha chỉnh lại: từ chỗ vượt quá về đúng đích, chậm dần.
        const local = (clamped - split) / (1 - split);
        const p = 1 - (1 - local) ** 2;
        return { x: aimX + (to.x - aimX) * p, y: aimY + (to.y - aimY) * p };
      }

      const local = clamped / split;
      const p = ballistic(local);
      const bulge = arc * Math.sin(Math.PI * local);
      return {
        x: from.x + (aimX - from.x) * p + nx * bulge + shake.x,
        y: from.y + (aimY - from.y) * p + ny * bulge + shake.y,
      };
    };

    return { duration, frameMs: pace.cursorFrameMs, at };
  };

  // Ngắm rồi mới bấm. Rê sang ô ngay bên cạnh thì gần như bấm luôn, còn vừa vượt cả màn hình
  // thì mất một nhịp định vị lại.
  const aimDelay = (dist) => {
    const share = Math.max(0.35, Math.min(dist / 600, 1));
    return wait(pace.beforeClickMs * share);
  };

  // Người gõ không đều: chậm lại ở dấu cách và sau dấu câu, thỉnh thoảng ngập ngừng một nhịp.
  const charDelay = (char, prev) => {
    let ms = pace.typeCharMs * between(0.65, 1.35);
    if (char === ' ') ms *= 1.4;
    if (prev && '.,;:!?、。」）)'.includes(prev)) ms *= 1.8;
    if (rng() < 0.05) ms *= between(2.2, 3.4);
    return Math.max(8, Math.round(ms));
  };

  const typeDelays = (text) => Array.from(String(text)).map((char, i, all) => charDelay(char, all[i - 1]));

  // Con trỏ chưa xuất hiện trong khung hình thì không có chỗ nào là "chỗ nó đang đứng".
  // Cho nó vào từ một điểm lệch tâm để cú di chuyển đầu tiên không giống một cú nhảy.
  const restingPoint = () => ({
    x: viewport.width * between(0.42, 0.58),
    y: viewport.height * between(0.5, 0.66),
  });

  return { wait, moveDuration, movePlan, aimDelay, charDelay, typeDelays, restingPoint, rng };
}

module.exports = { createHuman, createRng, hashSeed, ballistic };
