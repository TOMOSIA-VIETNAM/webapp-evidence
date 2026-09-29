// Driving the operating system's file picker, for a take that records the window or the screen.
//
// A page recording cannot contain the picker, so upload() sets the file on the field and the
// sheet never opens. A window recording can contain it, and that is often why it was asked for:
// the real picker is the evidence the operator wanted to see. Playwright cannot touch it — its
// keyboard goes to the page, and the picker is not in the page — so the keys are posted to the
// system instead, the way a keyboard would send them.
//
// macOS lets a process post keystrokes to another application only with Accessibility
// permission, granted per application to whatever runs the agent. The runner checks for it once,
// before the take, and falls back to setting the file directly without it; nothing here asks for
// it in the middle of a recording.
//
// Same approach as pointer.js: `python3` from the Command Line Tools reaches the C calls through
// `ctypes`, with nothing installed. Not `osascript`: System Events would need a second permission
// (Automation), and macOS asks for that one the first time it is used — mid-take.
const { execFileSync } = require('child_process');
const path = require('path');

const PROGRAM = `
import ctypes, json, sys, time
from ctypes import c_void_p, c_bool, c_long, c_int, c_int32, c_uint16, c_uint32, c_uint64, c_ulong, c_double, c_char_p

AS = ctypes.CDLL('/System/Library/Frameworks/ApplicationServices.framework/ApplicationServices')
CF = ctypes.CDLL('/System/Library/Frameworks/CoreFoundation.framework/CoreFoundation')

class Point(ctypes.Structure):
    _fields_ = [('x', c_double), ('y', c_double)]
class Size(ctypes.Structure):
    _fields_ = [('width', c_double), ('height', c_double)]
class Rect(ctypes.Structure):
    _fields_ = [('origin', Point), ('size', Size)]

# Every signature declared: a pointer returned as the default int is cut to 32 bits on arm64,
# and the next call dereferences half an address.
AS.AXIsProcessTrusted.restype = c_bool
AS.CGWindowListCopyWindowInfo.argtypes = [c_uint32, c_uint32]
AS.CGWindowListCopyWindowInfo.restype = c_void_p
AS.CGRectMakeWithDictionaryRepresentation.argtypes = [c_void_p, ctypes.POINTER(Rect)]
AS.CGRectMakeWithDictionaryRepresentation.restype = c_bool
AS.CGEventCreateKeyboardEvent.argtypes = [c_void_p, c_uint16, c_bool]
AS.CGEventCreateKeyboardEvent.restype = c_void_p
AS.CGEventSetFlags.argtypes = [c_void_p, c_uint64]
AS.CGEventKeyboardSetUnicodeString.argtypes = [c_void_p, c_ulong, ctypes.POINTER(c_uint16)]
AS.CGEventPost.argtypes = [c_uint32, c_void_p]
CF.CFArrayGetCount.argtypes = [c_void_p]
CF.CFArrayGetCount.restype = c_long
CF.CFArrayGetValueAtIndex.argtypes = [c_void_p, c_long]
CF.CFArrayGetValueAtIndex.restype = c_void_p
CF.CFDictionaryGetValue.argtypes = [c_void_p, c_void_p]
CF.CFDictionaryGetValue.restype = c_void_p
CF.CFStringCreateWithCString.argtypes = [c_void_p, c_char_p, c_uint32]
CF.CFStringCreateWithCString.restype = c_void_p
CF.CFNumberGetValue.argtypes = [c_void_p, c_int, c_void_p]
CF.CFNumberGetValue.restype = c_bool
CF.CFRelease.argtypes = [c_void_p]

UTF8 = 0x08000100
SINT64 = 4
ONSCREEN_ONLY = 1
EXCLUDE_DESKTOP = 16
HID_TAP = 0
FLAGS = {'cmd': 0x100000, 'shift': 0x20000}
KEYS = {'return': 36, 'escape': 53, 'g': 5, 'a': 0}

def cfstr(text):
    return CF.CFStringCreateWithCString(None, text.encode('utf-8'), UTF8)

def number(d, key):
    ref = CF.CFDictionaryGetValue(d, cfstr(key))
    if not ref:
        return None
    out = ctypes.c_int64()
    CF.CFNumberGetValue(ref, SINT64, ctypes.byref(out))
    return out.value

def windows():
    rows = []
    listing = AS.CGWindowListCopyWindowInfo(ONSCREEN_ONLY | EXCLUDE_DESKTOP, 0)
    for i in range(CF.CFArrayGetCount(listing)):
        d = CF.CFArrayGetValueAtIndex(listing, i)
        rect = Rect()
        bounds = CF.CFDictionaryGetValue(d, cfstr('kCGWindowBounds'))
        if not bounds or not AS.CGRectMakeWithDictionaryRepresentation(bounds, ctypes.byref(rect)):
            continue
        rows.append({
            'id': number(d, 'kCGWindowNumber'), 'pid': number(d, 'kCGWindowOwnerPID'),
            'layer': number(d, 'kCGWindowLayer'),
            'x': rect.origin.x, 'y': rect.origin.y, 'width': rect.size.width, 'height': rect.size.height,
        })
    CF.CFRelease(listing)
    return rows

# AppKit is loaded only here: it is the slow part of starting this program, and the window
# listing is polled while a picker is opening.
def objc():
    lib = ctypes.CDLL('/usr/lib/libobjc.A.dylib')
    ctypes.CDLL('/System/Library/Frameworks/AppKit.framework/AppKit')
    lib.objc_getClass.argtypes = [c_char_p]
    lib.objc_getClass.restype = c_void_p
    lib.sel_registerName.argtypes = [c_char_p]
    lib.sel_registerName.restype = c_void_p
    return lib

def frontmost():
    lib = objc()
    send = ctypes.CFUNCTYPE(c_void_p, c_void_p, c_void_p)(('objc_msgSend', lib))
    send_pid = ctypes.CFUNCTYPE(c_int32, c_void_p, c_void_p)(('objc_msgSend', lib))
    workspace = send(lib.objc_getClass(b'NSWorkspace'), lib.sel_registerName(b'sharedWorkspace'))
    app = send(workspace, lib.sel_registerName(b'frontmostApplication'))
    return send_pid(app, lib.sel_registerName(b'processIdentifier')) if app else None

def activate(pid):
    lib = objc()
    by_pid = ctypes.CFUNCTYPE(c_void_p, c_void_p, c_void_p, c_int32)(('objc_msgSend', lib))
    with_options = ctypes.CFUNCTYPE(c_bool, c_void_p, c_void_p, c_ulong)(('objc_msgSend', lib))
    app = by_pid(lib.objc_getClass(b'NSRunningApplication'),
                 lib.sel_registerName(b'runningApplicationWithProcessIdentifier:'), pid)
    # NSApplicationActivateIgnoringOtherApps
    return bool(app) and with_options(app, lib.sel_registerName(b'activateWithOptions:'), 2)

def post(code, flags=0, text=None):
    for down in (True, False):
        event = AS.CGEventCreateKeyboardEvent(None, code, down)
        # Set even when zero: an event created while a modifier is still held inherits it.
        AS.CGEventSetFlags(event, flags)
        if text is not None:
            units = text.encode('utf-16-le')
            buffer = (c_uint16 * (len(units) // 2)).from_buffer_copy(units)
            AS.CGEventKeyboardSetUnicodeString(event, len(buffer), buffer)
        AS.CGEventPost(HID_TAP, event)
        CF.CFRelease(event)
        time.sleep(0.008)

def keys(pid, actions):
    # Checked here as well as by the caller, right before the first key goes out: the gap between
    # the two is a process start, and what is typed next is a path followed by Return.
    if frontmost() != pid:
        sys.exit(3)
    for action in actions:
        if 'wait' in action:
            time.sleep(action['wait'] / 1000)
        elif 'text' in action:
            # One character per event: the field drops what arrives in a single long event.
            for ch in action['text']:
                post(0, 0, ch)
        else:
            flags = 0
            for modifier in action.get('with', []):
                flags |= FLAGS[modifier]
            post(KEYS[action['key']], flags)

command = sys.argv[1]
if command == 'trusted':
    sys.stdout.write('1' if AS.AXIsProcessTrusted() else '0')
elif command == 'windows':
    sys.stdout.write(json.dumps(windows()))
elif command == 'frontmost':
    sys.stdout.write(str(frontmost() or 0))
elif command == 'activate':
    sys.stdout.write('1' if activate(int(sys.argv[2])) else '0')
elif command == 'keys':
    keys(int(sys.argv[2]), json.loads(sys.argv[3]))
`;

const TIMEOUT_MS = 10000;
const FRONTMOST_REFUSED = 3;

const supported = () => process.platform === 'darwin';

function run(args) {
  return execFileSync('python3', ['-c', PROGRAM, ...args], {
    encoding: 'utf8', timeout: TIMEOUT_MS, stdio: ['ignore', 'pipe', 'pipe'],
  });
}

// False rather than an exception, whatever went wrong: no permission, no python3, not macOS.
// Every one of those means the same thing to the runner — set the file without the picker.
function accessibilityTrusted() {
  if (!supported()) return false;
  try {
    return run(['trusted']).trim() === '1';
  } catch {
    return false;
  }
}

const system = {
  windows: () => JSON.parse(run(['windows'])),
  frontmostPid: () => Number(run(['frontmost']).trim()) || null,
  activate: (pid) => run(['activate', String(pid)]).trim() === '1',
  // False when the program found another application in front and typed nothing
  keys(pid, actions) {
    try {
      run(['keys', String(pid), JSON.stringify(actions)]);
      return true;
    } catch (error) {
      if (error.status === FRONTMOST_REFUSED) return false;
      throw error;
    }
  },
};

const overlaps = (a, b) => a.x < b.x + b.width && b.x < a.x + a.width
  && a.y < b.y + b.height && b.y < a.y + a.height;

// The window that appeared over the browser since `before` was taken. Owner is not checked: the
// panel may belong to the browser or to the system service that draws open panels for it, and
// which one it is has not been measured on every macOS version. Layer 0 keeps out the menu bar,
// the Dock and notification banners, which sit on layers of their own.
function newWindowOver(before, after, rect) {
  const seen = new Set(before.map((w) => w.id));
  return after.find((w) => !seen.has(w.id) && w.layer === 0 && overlaps(w, rect)) || null;
}

// Go to Folder with the file's own path lands in its folder with the file selected — one jump,
// whatever folder the picker opened on. Select-all first because the field keeps whatever was
// typed into it last time.
function goToFileKeys(file, { sheetMs = 500 } = {}) {
  return [
    { key: 'g', with: ['cmd', 'shift'] },
    { wait: sheetMs },
    { key: 'a', with: ['cmd'] },
    { text: path.resolve(file) },
    { key: 'return' },
  ];
}

// Opens the picker with `open`, sends it to `file`, holds, and confirms.
//
// `onOpened` is called once the click has happened and before anything is typed, and `onLanded`
// once the jump has settled: what lies between the two is the picker on whatever folder it
// happened to open on, which the caller removes from the video. `io` is the operating system,
// replaceable so the order of what is typed and when it is refused can be checked without one.
async function chooseFile({
  pid, rect, file, open, onOpened = () => {}, onLanded = () => {}, holdMs, sleep,
  io = system, openTimeoutMs = 5000, settleMs = 400, closeTimeoutMs = 3000, pollMs = 100,
}) {
  // Whoever is in front receives the keys, so it has to be the browser that opened the picker.
  // Typed anywhere else, the next thing sent is a file path followed by Return.
  const send = (actions, what) => {
    if (io.frontmostPid() !== pid || !io.keys(pid, actions)) {
      throw new Error(
        `upload() stopped before ${what}: another application came to the front while the file ` +
        'picker was open, and the keys would have gone to it.\n' +
        'Nothing was typed. Leave the machine alone for the length of the take and record it again.'
      );
    }
  };

  // bringToFront() picks the tab; it does not always make the browser the active application.
  // Asked for once, here, and checked again before every key.
  if (io.frontmostPid() !== pid) {
    io.activate(pid);
    await sleep(300);
  }

  const before = io.windows();
  await open();
  onOpened();

  let panel = null;
  for (let waited = 0; !panel && waited <= openTimeoutMs; waited += pollMs) {
    panel = newWindowOver(before, io.windows(), rect);
    if (!panel) await sleep(pollMs);
  }
  if (!panel) {
    throw new Error(
      `upload() clicked the field and no file picker opened over the browser within ${openTimeoutMs}ms.\n` +
      'Check that the locator is the file input itself, or the element the page opens it from.'
    );
  }

  try {
    send(goToFileKeys(file), 'going to the file');
    await sleep(settleMs);
    onLanded();
    await sleep(holdMs);
    send([{ key: 'return' }], 'confirming the file');
  } catch (error) {
    // Left open, the panel sits in every frame until the recorder stops. Only dismissed when it
    // is safe to send a key at all.
    try {
      if (io.frontmostPid() === pid) io.keys(pid, [{ key: 'escape' }]);
    } catch {
      // Already gone, which is what was wanted
    }
    throw error;
  }

  for (let waited = 0; waited <= closeTimeoutMs; waited += pollMs) {
    if (!io.windows().some((w) => w.id === panel.id)) return;
    await sleep(pollMs);
  }
  throw new Error(
    'upload() confirmed the file and the picker is still open. The path was probably not found: ' +
    `${path.resolve(file)}\nCheck the file exists at that path.`
  );
}

// Which way upload() goes. A page recording never shows the picker whatever the machine allows;
// a window or screen recording shows it only when keys can be posted to it.
function uploadRoute({ mode, pickerAvailable }) {
  return mode !== 'page' && pickerAvailable ? 'picker' : 'intercept';
}

module.exports = {
  accessibilityTrusted, chooseFile, goToFileKeys, newWindowOver, uploadRoute, supported, system,
};
