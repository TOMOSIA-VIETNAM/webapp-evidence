// The caption layer overlaid on the page while recording. Two kinds, and they sit in different
// places because they do different jobs:
//
//   keys()  the key hint overlay — keyboard actions leave no trace at all on screen, and which
//           element the shortcut applies to is half of what it has to say, so it is anchored
//           beside that element.
//   note()  a caption sentence — for the moments the page cannot speak for itself, most clearly
//           widgets drawn by the operating system (the <select> dropdown, the file picker): the
//           viewer sees the value change without seeing why, and the caption fills exactly that
//           gap. This is narration, not annotation, so it goes where a film puts its subtitles:
//           along the bottom of the frame, out of the way of whatever is being proven.
//
// Only built in the top frame: node calls through the main frame, and if every frame drew its own
// overlay the video would have two overlapping ones.
(() => {
  if (window.top !== window.self) return;
  if (window.__evCaption) return;

  const GAP = 14;      // the distance from the key hint overlay to the element being operated on
  const EDGE = 16;     // the minimum margin from the edge of the frame
  const SUBTITLE_BOTTOM = 44;  // how far a caption sentence sits above the bottom edge

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
      /* A caption sentence is prose and reads as a subtitle: it wraps, it is centred, and it is
         wide enough that a sentence does not break into a narrow column. The key hint overlay
         stays one line beside its element. */
      #__ev_caption[data-kind="note"] {
        max-width: min(78vw, 900px); white-space: normal; line-height: 1.5;
        display: block; text-align: center;
        padding: 11px 18px; font-weight: 500; font-size: 15px;
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

  // Anchor the key hint overlay to whatever is being operated on, in order of how much it says:
  //   1. the rect passed in by the step script (the element that was just clicked)
  //   2. the selected text range — exactly what Cmd+C/Cmd+X is acting on
  //   3. the element holding focus (the input being typed into)
  // With no anchor it returns null, and the overlay falls to the bottom of the frame.
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

  // Along the bottom, centred — where a viewer already looks for words over a moving picture, and
  // where nothing in the middle of the page gets covered.
  const subtitle = (box) => ({
    left: Math.round((window.innerWidth - box.offsetWidth) / 2),
    top: Math.round(window.innerHeight - box.offsetHeight - SUBTITLE_BOTTOM),
  });

  // The key hint overlay must not cover the element it is describing — covering it loses the very
  // thing being proven. So place it below, above if there is no room, and beside it if neither fits.
  const place = (box, rect) => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const w = box.offsetWidth;
    const h = box.offsetHeight;
    const clamp = (v, max) => Math.max(EDGE, Math.min(v, max - EDGE));

    if (!rect) return subtitle(box);

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
    return subtitle(box);
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
    // A sentence is narration and belongs at the bottom whatever it happens to be about; only the
    // key hint overlay is placed against an element.
    const { left, top } = kind === 'note' ? subtitle(box) : place(box, anchorRect(rect));
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
    note({ text }) {
      show('note', escape(text));
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
