// The terminal panel drawn over the page while recording, in the same way as the cursor and the
// caption overlays: injected into every page, attached to documentElement, never interfering
// with the app underneath.
//
// It contains no parsing and no pacing. Everything about escape sequences, colours, overwriting
// lines and scrollback is decided in node, where it can be unit tested without a browser, and so
// is every number that decides how tall the panel is, which rows are on it and how long a move
// takes. What arrives here is a window — some rows, a height, a position and a duration — and
// this file animates to it.
(() => {
  if (window.top !== window.self) return;
  if (window.__evTerm) return;

  const HEADER_HEIGHT = 28;
  const PADDING = 12;
  // The height of one row, and the one number both sides have to agree on: the runner works out
  // how many rows fit and how far down to move from this exact figure, so it is written into the
  // stylesheet from here rather than left to a rule the page being recorded could influence.
  const LINE_HEIGHT = 1.45;

  // The eight basic colours and their bright counterparts. Warmer and less saturated than the
  // hardware palette a terminal would use: this sits over a screenshot of an application, and
  // pure #00ff00 next to a real UI reads as a graphic, not as a terminal.
  const PALETTE = [
    '#3f3f46', '#e06c63', '#8bbf73', '#d8b264', '#6b9fd4', '#b58cc4', '#5fb3b3', '#d4d4d8',
    '#71717a', '#f18a80', '#a5d68d', '#efcd7f', '#8bb9e6', '#cba6d8', '#7fcccc', '#fafafa',
  ];
  const FOREGROUND = '#e4e4e7';

  // Kept on window rather than in the element: when a framework swaps the whole body out, the
  // panel is rebuilt from this, so the scrollback of a command that is still running survives.
  //
  // `scrollRow` and `linesFrom` are counted in rows of the runner's screen, not of `lines`: the
  // slice sent moves along with the window, and a position measured inside it would mean
  // something different in every update — the move from one to the next would be drawn wrong.
  const state = (window.__evTermState = window.__evTermState || {
    open: false, lines: [], cursor: false, height: 300, fontSize: 13, title: '',
    opacity: 0.86, scrollRow: 0, linesFrom: 0,
  });

  const ensureStyle = () => {
    if (document.getElementById('__ev_term_style')) return;
    const style = document.createElement('style');
    style.id = '__ev_term_style';
    style.textContent = `
      #__ev_term {
        position: fixed; z-index: 2147483645; left: 0; right: 0; bottom: 0;
        display: flex; flex-direction: column;
        /* Translucent so the part of the application under the panel is still readable; the blur
           keeps the output on top of it legible over whatever it happens to be sitting on. */
        background: rgba(22, 22, 26, var(--ev-term-alpha, .86));
        -webkit-backdrop-filter: blur(6px);
        backdrop-filter: blur(6px);
        border-top: 1px solid rgba(255, 255, 255, .12);
        box-shadow: 0 -10px 34px rgba(0, 0, 0, .38);
        pointer-events: none;
        transform: translateY(100%);
        /* Two transitions doing two jobs: the slide is the panel arriving and leaving, the height
           is it being resized while it is already there. Declared together because a transition
           property replaces the whole list — setting one from script would otherwise cancel the
           other, and the panel would jump into place instead of sliding in. */
        transition: transform 260ms cubic-bezier(.22, .61, .36, 1),
                    height var(--ev-term-height-ms, 0ms) cubic-bezier(.22, .61, .36, 1);
      }
      #__ev_term[data-open="1"] { transform: translateY(0); }
      #__ev_term .__ev_term_bar {
        flex: 0 0 auto; display: flex; align-items: center; gap: 8px;
        height: ${HEADER_HEIGHT}px; padding: 0 12px;
        border-bottom: 1px solid rgba(255, 255, 255, .08);
        font: 500 12px/1 -apple-system, "Segoe UI", "Noto Sans JP", sans-serif;
        color: rgba(228, 228, 231, .62);
      }
      #__ev_term .__ev_term_dot {
        width: 9px; height: 9px; border-radius: 50%;
        background: rgba(255, 255, 255, .16);
      }
      #__ev_term .__ev_term_label { margin-left: 6px; }
      #__ev_term .__ev_term_body {
        flex: 1 1 auto; overflow: hidden;
        padding: ${PADDING}px 14px;
        font-family: "SF Mono", "JetBrains Mono", Menlo, Consolas, "Noto Sans Mono CJK JP", monospace;
        color: ${FOREGROUND};
        /* Fixed rather than inherited: the runner works out how many rows fit from this exact
           number, and a page whose own line-height leaked in here would make it send too many. */
        line-height: ${LINE_HEIGHT};
        /* One row per line, no wrapping: a long line is clipped rather than pushing the rows
           below it down and out of the panel. */
        white-space: pre;
      }
      /* The rows move as one block, so what is on the panel is a window over them rather than the
         last few that happen to have been sent. */
      #__ev_term .__ev_term_rows { will-change: transform; }
      /* Every row exactly one line tall, blank ones included: the runner counts rows and this is
         where that count becomes a distance, so a short row would put the window off by its
         difference for every row after it. */
      #__ev_term .__ev_term_rows > div { height: ${LINE_HEIGHT}em; }
      #__ev_term .__ev_term_cursor {
        display: inline-block; width: .58em; height: 1.05em;
        margin-bottom: -.2em; background: #c66a42;
        animation: __ev_term_blink 1.05s step-end infinite;
      }
      @keyframes __ev_term_blink { 50% { opacity: 0; } }
    `;
    document.head.appendChild(style);
  };

  function render(panel) {
    const rows = panel.querySelector('.__ev_term_rows');
    rows.textContent = '';
    state.lines.forEach((segments, index) => {
      const row = document.createElement('div');
      for (const segment of segments) {
        const span = document.createElement('span');
        span.textContent = segment.text;
        if (segment.fg !== null && segment.fg !== undefined) span.style.color = PALETTE[segment.fg];
        if (segment.bold) span.style.fontWeight = '700';
        if (segment.dim) span.style.opacity = '.62';
        row.appendChild(span);
      }
      // The caret belongs on the last line only, which is where the next character will land
      if (index === state.lines.length - 1 && state.cursor) {
        const caret = document.createElement('span');
        caret.className = '__ev_term_cursor';
        row.appendChild(caret);
      }
      rows.appendChild(row);
    });
  }

  // Transformed rather than scrolled: a scroll position is a whole number of pixels the browser
  // picks for itself, while a transform lands on the fraction of a row it was asked for and can
  // be animated between two of them. Linear and filling forwards, so the runner handing over a
  // new position every redraw reads as one continuous move at the browser's frame rate.
  function moveRows(panel, fromRow, ms) {
    const rows = panel.querySelector('.__ev_term_rows');
    const offset = (row) => `translateY(${-(row - state.linesFrom) * state.fontSize * LINE_HEIGHT}px)`;
    rows.getAnimations().forEach((animation) => animation.cancel());
    rows.style.transform = offset(state.scrollRow);
    if (!ms) return;
    rows.animate(
      [{ transform: offset(fromRow) }, { transform: offset(state.scrollRow) }],
      { duration: ms, easing: 'linear', fill: 'forwards' },
    );
  }

  function applyState(panel, { heightMs = 0, fromRow = state.scrollRow, scrollMs = 0 } = {}) {
    panel.style.setProperty('--ev-term-alpha', String(state.opacity));
    // Set before the height, so the transition already running is the one for this direction
    panel.style.setProperty('--ev-term-height-ms', `${heightMs}ms`);
    panel.style.height = `${state.height}px`;
    panel.querySelector('.__ev_term_body').style.fontSize = `${state.fontSize}px`;
    panel.querySelector('.__ev_term_label').textContent = state.title;
    render(panel);
    moveRows(panel, fromRow, scrollMs);
  }

  const ensurePanel = () => {
    let panel = document.getElementById('__ev_term');
    if (panel) return panel;

    panel = document.createElement('div');
    panel.id = '__ev_term';
    panel.innerHTML =
      '<div class="__ev_term_bar">' +
      '<span class="__ev_term_dot"></span><span class="__ev_term_dot"></span>' +
      '<span class="__ev_term_dot"></span><span class="__ev_term_label"></span></div>' +
      '<div class="__ev_term_body"><div class="__ev_term_rows"></div></div>';
    // Attached to documentElement rather than body: an SPA or Turbo swapping the body out
    // mid-take would otherwise take the panel with it, at the moment it holds what is being proven.
    document.documentElement.appendChild(panel);
    // A panel that has just been created has nothing to animate from: its height and its window
    // are put where they belong in one step, and the slide-in below is the only motion.
    applyState(panel);
    return panel;
  };

  // One entry point rather than open/draw/close, because a full page load throws this state
  // away while the runner's copy survives. Every update carries the whole state, so the first
  // draw after a navigation puts the panel back exactly as it was instead of showing an empty
  // one under a heading.
  window.__evTerm = {
    sync({ open, height, heightMs, fontSize, opacity, title, lines, linesFrom, scrollRow, scrollMs, cursor }) {
      const wasOpen = state.open;
      const fromRow = state.scrollRow;
      state.open = Boolean(open);
      state.lines = lines || [];
      state.cursor = Boolean(cursor);
      if (height) state.height = height;
      if (fontSize) state.fontSize = fontSize;
      if (opacity) state.opacity = opacity;
      if (title !== undefined) state.title = title;
      if (linesFrom !== undefined) state.linesFrom = linesFrom;
      if (scrollRow !== undefined) state.scrollRow = scrollRow;

      if (!state.open) {
        const existing = document.getElementById('__ev_term');
        if (existing) existing.removeAttribute('data-open');
        return;
      }

      ensureStyle();
      const fresh = !document.getElementById('__ev_term');
      const panel = ensurePanel();
      applyState(panel, fresh ? {} : { heightMs, fromRow, scrollMs });
      // Setting the attribute in the frame the element is created in skips the transition, so
      // the panel would appear rather than slide in. After a navigation there is nothing to
      // animate — the panel was already open before the page changed under it.
      if (fresh && !wasOpen) requestAnimationFrame(() => panel.setAttribute('data-open', '1'));
      else panel.setAttribute('data-open', '1');
    },

    // The runner refuses to click an element the panel is covering: a click that works and
    // cannot be seen proves nothing. Measured rather than read back from the state above, because
    // the panel spends a fifth of a second growing or shrinking towards that number and a click
    // can land at any point along the way.
    coveredFrom: () => {
      const panel = state.open ? document.getElementById('__ev_term') : null;
      if (!panel) return null;
      const box = panel.getBoundingClientRect();
      return window.innerHeight - box.height;
    },
  };

  const keepAlive = () => {
    if (document.getElementById('__ev_term')) return;
    if (!state.open && !state.lines.length) return;
    ensureStyle();
    const panel = ensurePanel();
    // Rebuilt after a body swap: the panel is already meant to be open, so it must not slide in
    // a second time in the middle of the take.
    if (state.open) panel.setAttribute('data-open', '1');
  };

  ['turbo:load', 'turbo:render', 'turbo:frame-render', 'pageshow'].forEach((event) => {
    document.addEventListener(event, keepAlive, true);
  });

  let pending = false;
  const observer = new MutationObserver(() => {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => { pending = false; keepAlive(); });
  });
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
