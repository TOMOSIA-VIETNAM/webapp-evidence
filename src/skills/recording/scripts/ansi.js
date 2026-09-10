// The screen model behind the terminal panel: raw pty bytes in, drawable lines out.
//
// All of it runs in node rather than in the page, for two reasons. The page cannot be unit
// tested without a browser, and this is where the fiddly cases live — an escape sequence split
// across two reads, a progress bar rewriting its line with \r, a colour run that outlives the
// line it started on. So the file injected into the page only draws an array it is handed.
//
// A line is kept as cells rather than as a string because \r, backspace and erase-line all
// address a column: "go back to column 0 and write over what is there" cannot be expressed by
// appending to a string, and a progress bar does exactly that dozens of times a second.

const MAX_COLUMNS = 400;

// Programs that take over the whole display (vim, htop, less) switch to the alternate screen
// buffer and then address the cursor by row and column. Drawing that into a line-oriented panel
// produces garbage that looks like a bug in the app being recorded, so refuse it by name instead.
class AlternateScreenError extends Error {
  constructor() {
    super(
      'The command switched the terminal to its alternate screen (a full-screen program such as ' +
      'vim, less or htop). The recording panel shows line-oriented output only.'
    );
    this.code = 'ALT_SCREEN';
  }
}

const DEFAULT_STYLE = { fg: null, bold: false, dim: false };

const sameStyle = (a, b) => a.fg === b.fg && a.bold === b.bold && a.dim === b.dim;

function createScreen({ maxLines = 500 } = {}) {
  let rows = [[]];
  let column = 0;
  let style = { ...DEFAULT_STYLE };

  // Carried between write() calls: a chunk can end in the middle of an escape sequence, and
  // parsing the halves independently would print the tail of the sequence as text.
  let escape = null; // null | { kind: 'esc' | 'csi' | 'osc', buffer: string }

  const current = () => rows[rows.length - 1];

  const newline = () => {
    rows.push([]);
    column = 0;
    if (rows.length > maxLines) rows.splice(0, rows.length - maxLines);
  };

  const putChar = (char) => {
    const line = current();
    if (column >= MAX_COLUMNS) newline();
    // Writing past the end of a shorter line: the gap has to become spaces, otherwise the cells
    // are holes and every later index is off by the size of the gap.
    while (line.length < column) line.push({ char: ' ', ...DEFAULT_STYLE });
    line[column] = { char, ...style };
    column += 1;
  };

  const applySgr = (params) => {
    if (!params.length) params = [0];
    for (let i = 0; i < params.length; i++) {
      const code = params[i];
      if (code === 0) style = { ...DEFAULT_STYLE };
      else if (code === 1) style.bold = true;
      else if (code === 2) style.dim = true;
      else if (code === 22) { style.bold = false; style.dim = false; }
      else if (code === 39) style.fg = null;
      else if (code >= 30 && code <= 37) style.fg = code - 30;
      else if (code >= 90 && code <= 97) style.fg = code - 90 + 8;
      // 38/48 introduce an extended colour whose own parameters follow. They are not drawn, but
      // they still have to be stepped over, or "38;5;196" would be read as a bold/colour trio.
      else if (code === 38 || code === 48) i += params[i + 1] === 5 ? 2 : params[i + 1] === 2 ? 4 : 0;
    }
  };

  const eraseLine = (mode) => {
    const line = current();
    if (mode === 1) {
      for (let i = 0; i <= column && i < line.length; i++) line[i] = { char: ' ', ...DEFAULT_STYLE };
    } else if (mode === 2) {
      line.length = 0;
    } else {
      line.length = Math.min(line.length, column);
    }
  };

  const runCsi = (buffer) => {
    const final = buffer[buffer.length - 1];
    const body = buffer.slice(0, -1);

    // A private sequence ("?" prefix): the only one that matters here is the switch to the
    // alternate screen. Cursor visibility and the rest are display state the panel does not have.
    if (body.startsWith('?')) {
      if (body.slice(1).split(';').includes('1049') && (final === 'h' || final === 'l')) {
        if (final === 'h') throw new AlternateScreenError();
      }
      return;
    }

    const params = body.split(';').filter((p) => p !== '').map(Number).filter((n) => Number.isFinite(n));
    if (final === 'm') applySgr(params);
    else if (final === 'K') eraseLine(params[0] || 0);
    // Everything else — cursor addressing, scroll regions, insert/delete — belongs to a screen
    // this panel does not model. Dropping the sequence is right; printing its bytes is not.
  };

  function write(chunk) {
    for (const char of String(chunk)) {
      if (escape) {
        if (escape.kind === 'esc') {
          if (char === '[') escape = { kind: 'csi', buffer: '' };
          else if (char === ']') escape = { kind: 'osc', buffer: '' };
          else escape = null; // a two-character sequence with nothing here to act on
          continue;
        }
        if (escape.kind === 'csi') {
          escape.buffer += char;
          const code = char.charCodeAt(0);
          if (code >= 0x40 && code <= 0x7e) {
            const { buffer } = escape;
            escape = null;
            runCsi(buffer);
          }
          continue;
        }
        // An operating-system command (a window title, most often) runs to BEL or to ESC \.
        if (char === '\x07') { escape = null; continue; }
        if (char === '\x1b') { escape = { kind: 'osc-end', buffer: '' }; continue; }
        if (escape.kind === 'osc-end') { escape = null; continue; }
        continue;
      }

      if (char === '\x1b') { escape = { kind: 'esc', buffer: '' }; continue; }
      if (char === '\n') { newline(); continue; }
      if (char === '\r') { column = 0; continue; }
      if (char === '\b') { column = Math.max(0, column - 1); continue; }
      if (char === '\t') { const next = column + (8 - (column % 8)); while (column < next) putChar(' '); continue; }
      if (char === '\x07') continue;                       // the bell has nothing to draw
      if (char < ' ' && char !== ' ') continue;            // any other control character
      putChar(char);
    }
  }

  // Cells are how the model works; runs of one style are how the page draws. Coalescing here
  // keeps the drawing side free of any logic worth testing.
  function lines() {
    return rows.map((cells) => {
      const segments = [];
      for (const cell of cells) {
        const last = segments[segments.length - 1];
        if (last && sameStyle(last, cell)) last.text += cell.char;
        else segments.push({ text: cell.char, fg: cell.fg, bold: cell.bold, dim: cell.dim });
      }
      return segments;
    });
  }

  return {
    write,
    lines,
    // The plain text of the screen, for waitFor() and for the runbook: the same content the
    // viewer reads, so a pattern that matches here matches what is on screen.
    text: () => rows.map((cells) => cells.map((c) => c.char).join('')).join('\n'),
    rowCount: () => rows.length,
    // The runner draws its own prompt, and a prompt has to start at the left edge. Whether the
    // command that just ran left the cursor mid-line is something only the screen knows.
    atLineStart: () => column === 0,
  };
}

module.exports = { createScreen, AlternateScreenError, MAX_COLUMNS };
