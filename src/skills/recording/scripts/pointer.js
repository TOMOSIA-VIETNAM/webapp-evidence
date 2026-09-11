// Where the real mouse pointer is, and putting it somewhere else.
//
// A window capture records the pointer wherever it was left — avfoundation does that whatever it
// is asked, measured. And Playwright clicks through the browser rather than by moving the
// pointer, so the real one never moves for the length of a take: what lands in the frame is a
// motionless arrow beside the one the runner draws and does move, which a reader takes for a
// fault in the application.
//
// So the pointer is parked outside the frame before the first one, and put back afterwards.
//
// macOS has no scriptable way to do this — no AppleScript verb — but it does have the C call,
// and `python3` from the Command Line Tools can reach it through `ctypes` with nothing installed.
// pyobjc is not needed and is not there.
const { execFileSync } = require('child_process');

const FRAMEWORK = '/System/Library/Frameworks/ApplicationServices.framework/ApplicationServices';

// One program for both directions: with no arguments it prints where the pointer is, with two it
// moves it there. Kept as one string so the two halves cannot drift apart.
const PROGRAM = `
import ctypes, sys
cg = ctypes.CDLL(${JSON.stringify(FRAMEWORK)})

class Point(ctypes.Structure):
    _fields_ = [('x', ctypes.c_double), ('y', ctypes.c_double)]

# Declared, not guessed. A struct passed or returned by value goes through registers on arm64,
# and ctypes gets that wrong without the signature: the move silently does nothing and the read
# takes the process down with it.
cg.CGWarpMouseCursorPosition.argtypes = [Point]
cg.CGWarpMouseCursorPosition.restype = ctypes.c_int32
cg.CGEventCreate.argtypes = [ctypes.c_void_p]
cg.CGEventCreate.restype = ctypes.c_void_p
cg.CGEventGetLocation.argtypes = [ctypes.c_void_p]
cg.CGEventGetLocation.restype = Point

if len(sys.argv) == 3:
    cg.CGWarpMouseCursorPosition(Point(float(sys.argv[1]), float(sys.argv[2])))
else:
    at = cg.CGEventGetLocation(cg.CGEventCreate(None))
    sys.stdout.write('%d %d' % (at.x, at.y))
`;

const TIMEOUT_MS = 5000;

const supported = () => process.platform === 'darwin';

function run(args) {
  return execFileSync('python3', ['-c', PROGRAM, ...args], {
    encoding: 'utf8', timeout: TIMEOUT_MS, stdio: ['ignore', 'pipe', 'pipe'],
  });
}

// Null rather than an exception: a take must not fail because the pointer could not be read.
// Every caller treats "unknown" as "leave it alone".
function readPointer() {
  if (!supported()) return null;
  try {
    const [x, y] = run([]).trim().split(/\s+/).map(Number);
    return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
  } catch {
    return null;
  }
}

function movePointer({ x, y }) {
  if (!supported()) return false;
  try {
    run([String(Math.round(x)), String(Math.round(y))]);
    return true;
  } catch {
    return false;
  }
}

// A point on the display the recorded frame does not cover.
//
// For a window capture that is anywhere outside the window, and the far corner of the display is
// the one place guaranteed not to be over it. For a screen capture the frame IS the display, so
// there is nowhere outside it — the corner is then only the least intrusive spot, and the pointer
// stays in the video. Saying so is better than pretending the case is handled.
function parkTarget(rect, display) {
  const corner = { x: display.width - 1, y: display.height - 1 };
  const outsideWindow = corner.x > rect.x + rect.width || corner.y > rect.y + rect.height;
  return { ...corner, outsideFrame: outsideWindow };
}

module.exports = { readPointer, movePointer, parkTarget, supported };
