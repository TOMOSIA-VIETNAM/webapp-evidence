// Every other application hidden for the length of a screen recording, and shown again after.
//
// A window capture crops to the browser, and a screen capture takes the whole display. Either
// way, what is behind or beside the browser can reach the frame: the desktop a sheet uncovers, the
// terminal the agent runs in, anything else left open. Hidden, they are not drawn at all — the
// same as Hide Others in any application's menu. Only the ones this runner hid are shown again;
// one the operator had hidden already stays hidden.
//
// Nothing needs a permission here: hiding and showing another application is open to any process
// on macOS. Same approach as pointer.js: `python3` from the Command Line Tools reaches AppKit
// through `ctypes`, with nothing installed.
const { execFileSync } = require('child_process');

const PROGRAM = `
import ctypes, json, sys
from ctypes import c_void_p, c_bool, c_long, c_int32, c_char_p

lib = ctypes.CDLL('/usr/lib/libobjc.A.dylib')
ctypes.CDLL('/System/Library/Frameworks/AppKit.framework/AppKit')
lib.objc_getClass.argtypes = [c_char_p]
lib.objc_getClass.restype = c_void_p
lib.sel_registerName.argtypes = [c_char_p]
lib.sel_registerName.restype = c_void_p

def send(restype, *argtypes):
    return ctypes.CFUNCTYPE(restype, c_void_p, c_void_p, *argtypes)(('objc_msgSend', lib))

sel = lib.sel_registerName
REGULAR = 0   # NSApplicationActivationPolicyRegular: an application with windows and a Dock icon

def by_pid(pid):
    return send(c_void_p, c_int32)(lib.objc_getClass(b'NSRunningApplication'),
                                   sel(b'runningApplicationWithProcessIdentifier:'), pid)

if sys.argv[1] == 'hide':
    keep = int(sys.argv[2])
    workspace = send(c_void_p)(lib.objc_getClass(b'NSWorkspace'), sel(b'sharedWorkspace'))
    apps = send(c_void_p)(workspace, sel(b'runningApplications'))
    hidden = []
    for i in range(send(c_long)(apps, sel(b'count'))):
        app = send(c_void_p, c_long)(apps, sel(b'objectAtIndex:'), i)
        pid = send(c_int32)(app, sel(b'processIdentifier'))
        if pid == keep or send(c_long)(app, sel(b'activationPolicy')) != REGULAR:
            continue
        if send(c_bool)(app, sel(b'isHidden')):
            continue
        if send(c_bool)(app, sel(b'hide')):
            hidden.append(pid)
    sys.stdout.write(json.dumps(hidden))
elif sys.argv[1] == 'unhide':
    for pid in json.loads(sys.argv[2]):
        app = by_pid(pid)
        if app:
            send(c_bool)(app, sel(b'unhide'))
`;

const TIMEOUT_MS = 10000;

const supported = () => process.platform === 'darwin';

function run(args) {
  return execFileSync('python3', ['-c', PROGRAM, ...args], {
    encoding: 'utf8', timeout: TIMEOUT_MS, stdio: ['ignore', 'pipe', 'pipe'],
  });
}

// The process ids it hid, for showOthers() to give back. An empty list rather than an exception:
// a take is not lost because the desktop could not be tidied, and the notice already told the
// operator to leave only the browser open.
function hideOthers(keepPid) {
  if (!supported()) return [];
  try {
    return JSON.parse(run(['hide', String(keepPid)]));
  } catch {
    return [];
  }
}

// Synchronous, so the interrupt route can call it with a signal already in flight
function showOthers(pids) {
  if (!supported() || !pids.length) return;
  try {
    run(['unhide', JSON.stringify(pids)]);
  } catch {
    // An application that quit meanwhile has nothing to show
  }
}

module.exports = { hideOthers, showOthers };
