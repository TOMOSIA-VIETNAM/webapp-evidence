// Lớp chú thích phủ lên trang khi quay. Hai loại, chung một cách định vị:
//
//   keys()  bảng phím tắt — thao tác bàn phím không để lại dấu vết nào trên hình
//   note()  câu chú thích — dùng cho những khoảnh khắc trang không tự nói ra được, rõ nhất là
//           widget do hệ điều hành vẽ (menu <select>, hộp chọn file): người xem thấy giá trị
//           đổi mà không thấy vì sao, câu chú thích lấp đúng khoảng trống đó.
//
// Chỉ dựng trong frame trên cùng: node gọi qua main frame, và mỗi frame tự vẽ một bảng thì
// video có hai bảng chồng nhau.
(() => {
  if (window.top !== window.self) return;
  if (window.__evCaption) return;

  const GAP = 14;      // khoảng cách từ bảng tới phần tử đang thao tác
  const EDGE = 16;     // lề tối thiểu so với cạnh khung hình

  const ensureStyle = () => {
    if (document.getElementById('__ev_caption_style')) return;
    const style = document.createElement('style');
    style.id = '__ev_caption_style';
    style.textContent = `
      #__ev_caption {
        position: fixed; z-index: 2147483647; top: 0; left: 0;
        display: flex; align-items: center; gap: 8px;
        padding: 9px 14px; border-radius: 10px;
        background: rgba(24, 24, 27, .93);
        box-shadow: 0 6px 20px rgba(0, 0, 0, .32);
        font: 600 15px/1.2 -apple-system, "Segoe UI", "Noto Sans JP", sans-serif;
        color: #fff; white-space: nowrap; pointer-events: none;
        opacity: 0; transition: opacity 140ms ease-out;
      }
      #__ev_caption[data-shown="1"] { opacity: 1; }
      #__ev_caption .__ev_cap {
        display: inline-block; min-width: 15px; padding: 3px 8px;
        border-radius: 6px; border: 1px solid rgba(255, 255, 255, .28);
        border-bottom-width: 3px;
        background: rgba(255, 255, 255, .14);
        text-align: center; font-size: 15px;
      }
      #__ev_caption .__ev_plus { opacity: .5; font-weight: 400; }
      #__ev_caption .__ev_label {
        margin-left: 4px; padding-left: 10px;
        border-left: 1px solid rgba(255, 255, 255, .22);
        font-weight: 500; font-size: 14px;
      }
      /* Câu chú thích là văn xuôi nên phải xuống dòng được; bảng phím thì luôn một dòng. */
      #__ev_caption[data-kind="note"] {
        max-width: 420px; white-space: normal; line-height: 1.45;
        border-left: 3px solid #c66a42; padding-left: 13px;
        font-weight: 500; font-size: 14px;
      }
    `;
    document.head.appendChild(style);
  };

  // Gắn vào documentElement chứ không phải body: framework thay cả body (Turbo, SPA) giữa lúc
  // bảng đang hiện thì bảng biến mất, đúng khoảnh khắc cần nhìn nhất.
  const ensureBox = () => {
    let box = document.getElementById('__ev_caption');
    if (!box) {
      box = document.createElement('div');
      box.id = '__ev_caption';
      document.documentElement.appendChild(box);
    }
    return box;
  };

  // Neo vào thứ đang được thao tác, theo thứ tự thứ nào nói lên nhiều nhất:
  //   1. rect do kịch bản truyền vào (phần tử vừa được bấm)
  //   2. vùng văn bản đang chọn — đúng thứ mà Cmd+C/Cmd+X đang tác động
  //   3. phần tử đang giữ focus (ô nhập đang gõ)
  // Không có neo nào thì trả null: bảng rơi về giữa đáy khung hình.
  const anchorRect = (explicit) => {
    if (explicit && explicit.width > 1 && explicit.height > 1) return explicit;

    const selection = window.getSelection();
    if (selection && !selection.isCollapsed && selection.rangeCount) {
      const rect = selection.getRangeAt(0).getBoundingClientRect();
      if (rect.width > 1 && rect.height > 1) return rect;
    }

    const active = document.activeElement;
    if (active && active !== document.body && active !== document.documentElement) {
      const rect = active.getBoundingClientRect();
      if (rect.width > 1 && rect.height > 1) return rect;
    }
    return null;
  };

  // Bảng không được che chính phần tử đang thao tác — che thì mất luôn thứ cần chứng minh.
  // Nên đặt bên dưới nó, hết chỗ thì bên trên, hết cả hai thì cạnh bên.
  const place = (box, rect) => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const w = box.offsetWidth;
    const h = box.offsetHeight;
    const clamp = (v, max) => Math.max(EDGE, Math.min(v, max - EDGE));

    if (!rect) {
      return { left: Math.round((vw - w) / 2), top: Math.round(vh - h - 2 * EDGE) };
    }

    const centered = clamp(rect.left + rect.width / 2 - w / 2, vw - w);

    if (rect.bottom + GAP + h <= vh - EDGE) {
      return { left: Math.round(centered), top: Math.round(rect.bottom + GAP) };
    }
    if (rect.top - GAP - h >= EDGE) {
      return { left: Math.round(centered), top: Math.round(rect.top - GAP - h) };
    }

    const top = Math.round(clamp(rect.top + rect.height / 2 - h / 2, vh - h));
    if (rect.right + GAP + w <= vw - EDGE) return { left: Math.round(rect.right + GAP), top };
    if (rect.left - GAP - w >= EDGE) return { left: Math.round(rect.left - GAP - w), top };
    return { left: Math.round((vw - w) / 2), top: Math.round(vh - h - 2 * EDGE) };
  };

  // Nội dung do kịch bản viết, có thể chứa < & " — chèn thô vào innerHTML thì bảng vỡ.
  const escape = (text) => String(text).replace(/[&<>"]/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]
  ));

  const show = (kind, html, rect) => {
    ensureStyle();
    const box = ensureBox();
    box.dataset.kind = kind;
    box.innerHTML = html;

    // Đo trước khi hiện: đo lúc còn ẩn thì kích thước đã đúng, còn nếu hiện rồi mới dời
    // thì người xem thấy bảng nhảy một nhịp.
    box.style.visibility = 'hidden';
    box.removeAttribute('data-shown');
    const { left, top } = place(box, anchorRect(rect));
    box.style.left = `${left}px`;
    box.style.top = `${top}px`;
    box.style.visibility = '';
    box.setAttribute('data-shown', '1');
  };

  window.__evCaption = {
    keys({ caps, label, rect }) {
      const parts = caps.map((cap) => `<span class="__ev_cap">${escape(cap)}</span>`);
      show('keys', parts.join('<span class="__ev_plus">+</span>')
        + (label ? `<span class="__ev_label">${escape(label)}</span>` : ''), rect);
    },
    note({ text, rect }) {
      show('note', escape(text), rect);
    },
    hide() {
      const box = document.getElementById('__ev_caption');
      if (!box) return;
      box.removeAttribute('data-shown');
      // Hai chú thích liền nhau: lần sau đã hiện lại bảng thì đừng xoá nó theo lệnh ẩn cũ.
      setTimeout(() => {
        if (!box.hasAttribute('data-shown')) box.remove();
      }, 220);
    },
  };
})();
