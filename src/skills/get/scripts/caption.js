// The caption layer overlaid on the page while recording. Two kinds, positioned the same way:
//
//   keys()  the key hint overlay — keyboard actions leave no trace at all on screen
//   note()  a caption sentence — for the moments the page cannot speak for itself, most clearly
//           widgets drawn by the operating system (the <select> dropdown, the file picker): the
//           viewer sees the value change without seeing why, and the caption fills exactly that
//           gap.
//
// Only built in the top frame: node calls through the main frame, and if every frame drew its own
// overlay the video would have two overlapping ones.
(() => {
  if (window.top !== window.self) return;
  if (window.__evCaption) return;

  const GAP = 14;      // the distance from the overlay to the element being operated on
  const EDGE = 16;     // the minimum margin from the edge of the frame

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
      /* A caption sentence is prose, so it has to wrap; the key hint overlay is always one line. */
      #__ev_caption[data-kind="note"] {
        max-width: 420px; white-space: normal; line-height: 1.45;
        border-left: 3px solid #c66a42; padding-left: 13px;
        font-weight: 500; font-size: 14px;
      }
    `;
    document.head.appendChild(style);
  };

  // Attached to documentElement rather than body: if a framework swaps the whole body (Turbo, an
  // SPA) while the overlay is up, the overlay disappears at the very moment it is most needed.
  const ensureBox = () => {
    let box = document.getElementById('__ev_caption');
    if (!box) {
      box = document.createElement('div');
      box.id = '__ev_caption';
      document.documentElement.appendChild(box);
    }
    return box;
  };

  // Anchor to whatever is being operated on, in order of how much it says:
  //   1. the rect passed in by the step script (the element that was just clicked)
  //   2. the selected text range — exactly what Cmd+C/Cmd+X is acting on
  //   3. the element holding focus (the input being typed into)
  // With no anchor it returns null: the overlay falls back to the bottom centre of the frame.
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

  // The overlay must not cover the element being operated on — covering it loses the very thing
  // being proven. So place it below, above if there is no room, and beside it if neither fits.
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

  // The content is written by the step script and may contain < & " — dropping it raw into
  // innerHTML breaks the overlay.
  const escape = (text) => String(text).replace(/[&<>"]/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]
  ));

  const show = (kind, html, rect) => {
    ensureStyle();
    const box = ensureBox();
    box.dataset.kind = kind;
    box.innerHTML = html;

    // Measure before showing: measuring while still hidden already gives the right size, whereas
    // showing it first and then moving it makes the viewer see the overlay jump a beat.
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
      // Two captions back to back: if the overlay has already been shown again by then, do not
      // remove it because of the older hide call.
      setTimeout(() => {
        if (!box.hasAttribute('data-shown')) box.remove();
      }, 220);
    },
  };
})();
