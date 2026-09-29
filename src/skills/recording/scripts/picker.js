// Driving the operating system's file picker, for a take that records the window or the screen.
//
// A page recording cannot contain the picker, so upload() sets the file on the field and the
// sheet never opens. A window recording can contain it, and that is often why it was asked for:
// the real picker is the evidence the operator wanted to see. Playwright cannot touch it — its
// keyboard goes to the page, and the picker is not in the page — so it is driven through the
// system instead: a few keys posted the way a keyboard would send them, and the rest through the
// Accessibility API, which reads and sets the picker's own controls.
//
// The path itself is never typed. Posted key by key it goes through the operator's input method,
// and one that composes characters rewrites it — measured with a Vietnamese one, where
// "/private" arrived as "aaivate". Setting the Go to Folder field's value directly skips that.
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
AS.AXUIElementCreateApplication.argtypes = [c_int32]
AS.AXUIElementCreateApplication.restype = c_void_p
AS.AXUIElementCopyAttributeValue.argtypes = [c_void_p, c_void_p, ctypes.POINTER(c_void_p)]
AS.AXUIElementCopyAttributeValue.restype = c_int32
AS.AXUIElementSetAttributeValue.argtypes = [c_void_p, c_void_p, c_void_p]
AS.AXUIElementSetAttributeValue.restype = c_int32
AS.AXValueCreate.argtypes = [c_int, c_void_p]
AS.AXValueCreate.restype = c_void_p
AS.AXValueGetValue.argtypes = [c_void_p, c_int, c_void_p]
AS.AXValueGetValue.restype = c_bool
CF.CFStringGetCString.argtypes = [c_void_p, c_char_p, c_long, c_uint32]
CF.CFStringGetCString.restype = c_bool
CF.CFBooleanGetValue.argtypes = [c_void_p]
CF.CFBooleanGetValue.restype = c_bool

UTF8 = 0x08000100
SINT64 = 4
ONSCREEN_ONLY = 1
EXCLUDE_DESKTOP = 16
HID_TAP = 0
FLAGS = {'cmd': 0x100000, 'shift': 0x20000}
KEYS = {'return': 36, 'escape': 53, 'g': 5, 'right': 124, 'down': 125}
AX_POINT = 1
AX_SIZE = 2
# Room left between the picker and the window's edges, so its shadow stays inside the frame too
MARGIN = 16

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

def post(code, flags=0):
    for down in (True, False):
        event = AS.CGEventCreateKeyboardEvent(None, code, down)
        # Set even when zero: an event created while a modifier is still held inherits it.
        AS.CGEventSetFlags(event, flags)
        AS.CGEventPost(HID_TAP, event)
        CF.CFRelease(event)
        time.sleep(0.008)

def keys(pid, actions):
    # Checked before every key, not once per batch: whatever comes to the front between two of
    # them would receive the rest, Return included.
    for action in actions:
        if frontmost() != pid:
            sys.exit(3)
        flags = 0
        for modifier in action.get('with', []):
            flags |= FLAGS[modifier]
        post(KEYS[action['key']], flags)

def ax(element, name):
    out = c_void_p()
    return out.value if AS.AXUIElementCopyAttributeValue(element, cfstr(name), ctypes.byref(out)) == 0 else None

def ax_text(ref):
    if not ref:
        return None
    buffer = ctypes.create_string_buffer(4096)
    return buffer.value.decode('utf-8') if CF.CFStringGetCString(ref, buffer, 4096, UTF8) else None

def ax_children(element, name):
    listing = ax(element, name)
    return [CF.CFArrayGetValueAtIndex(listing, i) for i in range(CF.CFArrayGetCount(listing))] if listing else []

def ax_rect(element):
    at, size = Point(), Size()
    for name, kind, out in (('AXPosition', AX_POINT, at), ('AXSize', AX_SIZE, size)):
        ref = ax(element, name)
        if ref:
            AS.AXValueGetValue(ref, kind, ctypes.byref(out))
    return {'x': at.x, 'y': at.y, 'width': size.width, 'height': size.height}

def ax_set(element, name, kind, value):
    return AS.AXUIElementSetAttributeValue(element, cfstr(name), AS.AXValueCreate(kind, ctypes.byref(value))) == 0

# The picker opens at whatever size it was last left at, which can be most of the display. A
# sheet wider than its window pushes the window aside to make room, and the recording, cropped
# to where the window was, then holds the desktop instead. So the window goes back to where it
# was and the picker is made to fit inside it. macOS holds the picker to a minimum size, so the
# caller checks what it got rather than what it asked for.
def fit(pid, x, y, width, height):
    for window in ax_children(AS.AXUIElementCreateApplication(pid), 'AXWindows'):
        sheets = [c for c in ax_children(window, 'AXChildren') if ax_text(ax(c, 'AXRole')) == 'AXSheet']
        if not sheets:
            continue
        ax_set(window, 'AXPosition', AX_POINT, Point(x, y))
        top = ax_rect(sheets[0])['y']
        ax_set(sheets[0], 'AXSize', AX_SIZE, Size(width - 2 * MARGIN, y + height - top - MARGIN))
        return {'window': ax_rect(window), 'sheet': ax_rect(sheets[0])}
    return None

def sheet(pid):
    for window in ax_children(AS.AXUIElementCreateApplication(pid), 'AXWindows'):
        for child in ax_children(window, 'AXChildren'):
            if ax_text(ax(child, 'AXRole')) == 'AXSheet':
                return child
    return None

# The folder the picker is showing, as its Where pop-up names it. Read to know the picker has
# actually arrived: after Go to Folder it goes on showing the folder it was on for a moment.
def where(pid):
    panel = sheet(pid)
    for child in ax_children(panel, 'AXChildren') if panel else []:
        if ax_text(ax(child, 'AXRole')) == 'AXPopUpButton':
            return ax_text(ax(child, 'AXValue'))
    return None

# Whether the picker's confirm button can be pressed, which it can only once a file is selected:
# with a folder selected, or nothing, it stays greyed out. Found by position rather than by its
# title, which is in the operator's language — the last button of the picker, after Cancel.
def can_confirm(pid):
    panel = sheet(pid)
    buttons = [c for c in ax_children(panel, 'AXChildren') if ax_text(ax(c, 'AXRole')) == 'AXButton'] if panel else []
    enabled = ax(buttons[-1], 'AXEnabled') if buttons else None
    return bool(enabled) and CF.CFBooleanGetValue(enabled)

def focused_role(pid):
    element = ax(AS.AXUIElementCreateApplication(pid), 'AXFocusedUIElement')
    return ax_text(ax(element, 'AXRole')) if element else None

# The field Go to Folder puts up has the keyboard once it is open; its value is set, not typed.
def set_focused_text(pid, text):
    element = ax(AS.AXUIElementCreateApplication(pid), 'AXFocusedUIElement')
    if not element or ax_text(ax(element, 'AXRole')) != 'AXTextField':
        return False
    return AS.AXUIElementSetAttributeValue(element, cfstr('AXValue'), cfstr(text)) == 0

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
elif command == 'fit':
    sys.stdout.write(json.dumps(fit(int(sys.argv[2]), *map(float, sys.argv[3:7]))))
elif command == 'where':
    sys.stdout.write(where(int(sys.argv[2])) or '')
elif command == 'canconfirm':
    sys.stdout.write('1' if can_confirm(int(sys.argv[2])) else '0')
elif command == 'focused':
    sys.stdout.write(focused_role(int(sys.argv[2])) or '')
elif command == 'settext':
    sys.stdout.write('1' if set_focused_text(int(sys.argv[2]), sys.argv[3]) else '0')
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
  fit: (pid, rect) => JSON.parse(run(['fit', String(pid), ...[rect.x, rect.y, rect.width, rect.height].map(String)])),
  focusedRole: (pid) => run(['focused', String(pid)]).trim() || null,
  where: (pid) => run(['where', String(pid)]).trim() || null,
  canConfirm: (pid) => run(['canconfirm', String(pid)]).trim() === '1',
  setText: (pid, text) => run(['settext', String(pid), text]).trim() === '1',
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

// Whether `inner` lies within `outer`, give or take the rounding of a point
const inside = (inner, outer) => inner.x >= outer.x - 1 && inner.y >= outer.y - 1
  && inner.x + inner.width <= outer.x + outer.width + 1
  && inner.y + inner.height <= outer.y + outer.height + 1;

// Opens the picker with `open`, takes it to the folder holding `file`, selects the file there,
// and confirms — the way a person would: go to the folder, see what is in it, pick one.
//
// `folder` should hold one file and nothing else. It is selected with the arrow keys, which no
// input method rewrites: Right moves into the folder's own column when the picker shows columns,
// and Down lands on the first entry when it shows a list or icons. With one file each lands on
// it, whichever view the operator left the picker in. Each key is followed by a look at whether
// the picker can now confirm, rather than a fixed wait: a column still filling in takes the key
// and does nothing with it, measured. The field check afterwards is what catches a folder with
// more in it.
//
// `onOpened` is called once the click has happened, and `onLanded` once the picker is in
// `folder`: what lies between the two is the picker on whatever folder it happened to open on,
// and a Go to Folder field still holding the last path someone went to, which the caller removes
// from the video. `io` is the operating system, replaceable so the order of what is sent and
// when it is refused can be checked without one.
async function chooseFile({
  pid, rect, folder, open, onOpened = () => {}, onLanded = () => {}, holdMs, sleep,
  io = system, openTimeoutMs = 5000, fieldTimeoutMs = 2000, suggestMs = 600, landTimeoutMs = 3000,
  settleMs = 400, selectTimeoutMs = 1000, closeTimeoutMs = 3000, pollMs = 100,
}) {
  // Whoever is in front receives the keys, so it has to be the browser that opened the picker.
  // Sent anywhere else, the next key is a Return.
  const send = (actions, what) => {
    if (io.frontmostPid() !== pid || !io.keys(pid, actions)) {
      throw new Error(
        `upload() stopped before ${what}: another application came to the front while the file ` +
        'picker was open, and the keys would have gone to it.\n' +
        'Nothing was typed into it. Leave the machine alone for the length of the take and record it again.'
      );
    }
  };
  // Against the clock rather than a sum of sleeps: every look at the system starts a process.
  const waitFor = async (timeoutMs, look) => {
    for (const until = Date.now() + timeoutMs; Date.now() <= until;) {
      const found = look();
      if (found) return found;
      await sleep(pollMs);
    }
    return null;
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

  const panel = await waitFor(openTimeoutMs, () => newWindowOver(before, io.windows(), rect));
  if (!panel) {
    throw new Error(
      `upload() clicked the field and no file picker opened over the browser within ${openTimeoutMs}ms.\n` +
      'Check that the locator is the file input itself, or the element the page opens it from.'
    );
  }

  try {
    const fitted = io.fit(pid, rect);
    if (!fitted || !inside(fitted.sheet, rect)) {
      const size = fitted ? `${Math.round(fitted.sheet.width)}x${Math.round(fitted.sheet.height)}` : 'unknown';
      throw new Error(
        `upload() opened the file picker and it does not fit inside the browser window: the picker ` +
        `is ${size} at its smallest, the window ${rect.width}x${rect.height}.\n` +
        'Part of it would be outside the recording. Raise recording.viewport and record again.'
      );
    }

    send([{ key: 'g', with: ['cmd', 'shift'] }], 'opening Go to Folder');
    if (!await waitFor(fieldTimeoutMs, () => io.focusedRole(pid) === 'AXTextField')) {
      throw new Error('upload() asked the file picker for Go to Folder, and no field for the path came up.');
    }
    if (!io.setText(pid, `${folder}/`)) {
      throw new Error('upload() could not put the folder\'s path into the Go to Folder field.');
    }
    // The field looks the path up before Return means anything
    await sleep(suggestMs);
    send([{ key: 'return' }], 'going to the folder');
    if (!await waitFor(landTimeoutMs, () => io.where(pid) === path.basename(folder))) {
      throw new Error(`upload() sent the file picker to ${folder} and it did not get there.`);
    }
    // Arrived is not drawn: the listing fills in a moment after the Where pop-up changes
    await sleep(settleMs);
    onLanded();

    await sleep(holdMs);
    let selected = false;
    for (const key of ['right', 'down']) {
      send([{ key }], 'selecting the file');
      selected = Boolean(await waitFor(selectTimeoutMs, () => io.canConfirm(pid)));
      if (selected) break;
    }
    if (!selected) {
      throw new Error(`upload() took the file picker to ${folder} and could not select the file in it.`);
    }
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

  if (await waitFor(closeTimeoutMs, () => !io.windows().some((w) => w.id === panel.id))) return;
  throw new Error(
    `upload() confirmed the file and the picker is still open. The folder was probably not found: ${folder}`
  );
}

// Which way upload() goes. A page recording never shows the picker whatever the machine allows;
// a window or screen recording shows it only when keys can be posted to it.
function uploadRoute({ mode, pickerAvailable }) {
  return mode !== 'page' && pickerAvailable ? 'picker' : 'intercept';
}

module.exports = {
  accessibilityTrusted, chooseFile, newWindowOver, uploadRoute, supported, system,
};
