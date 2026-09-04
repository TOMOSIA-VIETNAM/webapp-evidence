// Con trỏ giả cho video. Bản quay của Playwright không chứa con trỏ chuột thật,
// nên vẽ con trỏ và vòng ripple mỗi lần bấm để người xem thấy click rơi vào đâu.
(() => {
  const install = () => {
    if (document.getElementById('__ev_cursor')) return;

    const style = document.createElement('style');
    style.textContent = `
      #__ev_cursor {
        position: fixed; z-index: 2147483647; top: 0; left: 0;
        width: 30px; height: 30px; pointer-events: none;
        transform: translate(-2px, -2px);
        transition: transform 40ms linear;
        filter: drop-shadow(0 2px 3px rgba(0, 0, 0, .28));
      }
      .__ev_ripple {
        position: fixed; z-index: 2147483646; pointer-events: none;
        width: 18px; height: 18px; margin: -9px 0 0 -9px;
        border-radius: 50%; background: rgba(198, 106, 66, .35);
        border: 2px solid rgba(198, 106, 66, .95);
        animation: __ev_ripple 800ms ease-out forwards;
      }
      @keyframes __ev_ripple {
        from { transform: scale(.6); opacity: 1; }
        to   { transform: scale(3.4); opacity: 0; }
      }
    `;
    document.head.appendChild(style);

    const cursor = document.createElement('div');
    cursor.id = '__ev_cursor';
    cursor.innerHTML =
      '<svg width="30" height="30" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">' +
      // Phần đuôi là hình bình hành chuẩn: hai cạnh dài cùng vector (3.0, 6.2), hai cạnh ngắn
      // cùng vector (3.0, -1.4). Lệch vài phần mười là mắt thấy ngay đuôi bị vẹo.
      '<path d="M5 2.5 L5 19.4 L9.4 15.4 L12.4 21.6 L15.4 20.2 L12.4 14 L18.5 14 Z" ' +
      'fill="#ffffff" stroke="#c66a42" stroke-width="1.7" stroke-linejoin="round" stroke-linecap="round"/></svg>';
    document.body.appendChild(cursor);

    // Vị trí giữ ở window: khi framework thay cả body (Turbo, htmx, SPA) thì phần tử con trỏ
    // bị gỡ, gắn lại phải đúng chỗ chuột đang đứng chứ không nhảy về giữa màn hình.
    // Trang có iframe thì init script chạy trong từng frame. Frame nào chưa nhận chuột thì ẩn,
    // nếu không video sẽ có một con trỏ đứng im bên cạnh con trỏ đang thao tác.
    const isTopFrame = window.top === window.self;
    if (!isTopFrame && !window.__evCursorSeen) cursor.style.display = 'none';

    window.__evCursorPos = window.__evCursorPos || { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    const draw = () => {
      const { x, y } = window.__evCursorPos;
      cursor.style.transform = `translate(${x - 2}px, ${y - 2}px)`;
    };
    draw();

    document.addEventListener('mousemove', (e) => {
      window.__evCursorSeen = true;
      cursor.style.display = '';
      window.__evCursorPos = { x: e.clientX, y: e.clientY };
      draw();
    }, true);
    document.addEventListener('mousedown', (e) => {
      const ripple = document.createElement('div');
      ripple.className = '__ev_ripple';
      ripple.style.left = `${e.clientX}px`;
      ripple.style.top = `${e.clientY}px`;
      document.body.appendChild(ripple);
      setTimeout(() => ripple.remove(), 850);
    }, true);
  };

  // Điều hướng bằng Turbo/SPA không tải lại trang nên init script không chạy lần nữa, trong khi
  // body bị thay mới và con trỏ biến mất giữa video. Theo dõi và gắn lại ngay khi mất.
  const keepAlive = () => {
    if (!document.getElementById('__ev_cursor')) install();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install);
  } else {
    install();
  }

  ['turbo:load', 'turbo:render', 'turbo:frame-render', 'pageshow'].forEach((evt) => {
    document.addEventListener(evt, keepAlive, true);
  });

  // SPA render liên tục sẽ bắn rất nhiều mutation; gom lại theo khung hình để không đua với
  // vòng render của app.
  let pending = false;
  const observer = new MutationObserver(() => {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => {
      pending = false;
      keepAlive();
    });
  });

  // Init script chạy trước khi trang dựng cây DOM, nên documentElement có thể chưa tồn tại:
  // observe(null) ném lỗi, và lỗi đó lọt vào log lỗi trang của evidence như thể app đang hỏng.
  const observe = () => observer.observe(document.documentElement, { childList: true, subtree: true });
  if (document.documentElement) {
    observe();
  } else {
    document.addEventListener('readystatechange', function once() {
      if (!document.documentElement) return;
      document.removeEventListener('readystatechange', once);
      observe();
    });
  }
})();
