// A fake cursor for the video. Playwright's recording does not contain the real mouse cursor,
// so draw a cursor and a ripple ring on each click, so the viewer sees where the click lands.
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
      // The tail is a proper parallelogram: the two long edges share the vector (3.0, 6.2), the
      // two short edges the vector (3.0, -1.4). A few tenths off and the eye immediately sees a
      // crooked tail.
      '<path d="M5 2.5 L5 19.4 L9.4 15.4 L12.4 21.6 L15.4 20.2 L12.4 14 L18.5 14 Z" ' +
      'fill="#ffffff" stroke="#c66a42" stroke-width="1.7" stroke-linejoin="round" stroke-linecap="round"/></svg>';
    document.body.appendChild(cursor);

    // The position is kept on window: when a framework swaps the whole body (Turbo, htmx, an SPA)
    // the cursor element is removed, and reattaching it has to land exactly where the mouse is
    // standing instead of jumping back to the middle of the screen.
    // On a page with iframes the init script runs inside every frame. A frame that has not
    // received the mouse yet keeps its cursor hidden, otherwise the video would show a motionless
    // cursor next to the one actually operating.
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

  // Navigating with Turbo/an SPA does not reload the page, so the init script does not run again,
  // while the body is replaced and the cursor disappears in the middle of the video. Watch for
  // that and reattach as soon as it is gone.
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

  // An SPA rendering continuously fires a great many mutations; batch them per frame so this does
  // not race the app's own render loop.
  let pending = false;
  const observer = new MutationObserver(() => {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => {
      pending = false;
      keepAlive();
    });
  });

  // The init script runs before the page builds its DOM tree, so documentElement may not exist
  // yet: observe(null) throws, and that error lands in the evidence page error log as if the app
  // were broken.
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
