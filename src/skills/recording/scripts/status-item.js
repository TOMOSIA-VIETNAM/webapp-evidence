// A dot in the menu bar saying whose the machine is while screen takes are being made.
//
//   grey             nothing is about to move the pointer: the machine is the person's
//   yellow + seconds a take is about to start, or to carry on, once the machine is left alone
//   red              a take is recording: leave the mouse and keyboard alone
//
// Between two takes the runner is not running at all — a step failed, the agent is rewriting the
// script — and nothing on the screen used to say so. The person either sat waiting, or went back
// to work and had the machine taken from them when the next take began.
//
// The state is read from the lock each take already holds (lock.js), which the runner adds the
// state to: a run that crashed leaves a lock whose process is gone, and that reads as grey rather
// than as a red dot nobody will ever clear. One item for the whole machine, whichever project is
// recording: it runs on its own, outlives the takes, and leaves once it has shown grey for
// IDLE_EXIT_SECONDS.
//
// AppKit through `python3` and `ctypes`, like desktop.js — nothing installed. The process is an
// accessory application, with no Dock icon, which also keeps desktop.js from hiding it.
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { DIR, isRunning } = require('./lock');

const PID_FILE = path.join(DIR, 'status-item.pid');
// Long enough to span an agent rewriting a step script between two takes: the grey dot is the
// answer to "can I use the machine now", and it is needed most in that gap.
const IDLE_EXIT_SECONDS = 30 * 60;

const PROGRAM = `
import ctypes, glob, json, os, sys, time
from ctypes import c_void_p, c_char_p, c_double, c_long, c_bool

DIR, PID_FILE, IDLE_EXIT = sys.argv[1], sys.argv[2], float(sys.argv[3])

def alive(pid):
    try:
        os.kill(pid, 0)
        return True
    except PermissionError:
        return True
    except (OSError, TypeError, ValueError):
        return False

def mine_or_none():
    try:
        other = int(open(PID_FILE).read())
    except (OSError, ValueError):
        return True
    return other == os.getpid() or not alive(other)

if not mine_or_none():
    sys.exit(0)   # another one is already showing
open(PID_FILE, 'w').write(str(os.getpid()))

lib = ctypes.CDLL('/usr/lib/libobjc.A.dylib')
ctypes.CDLL('/System/Library/Frameworks/AppKit.framework/AppKit')
lib.objc_getClass.argtypes = [c_char_p]
lib.objc_getClass.restype = c_void_p
lib.sel_registerName.argtypes = [c_char_p]
lib.sel_registerName.restype = c_void_p

def send(restype, *argtypes):
    return ctypes.CFUNCTYPE(restype, c_void_p, c_void_p, *argtypes)(('objc_msgSend', lib))

cls, sel = lib.objc_getClass, lib.sel_registerName
def nsstring(text):
    return send(c_void_p, c_char_p)(cls(b'NSString'), sel(b'stringWithUTF8String:'), text.encode())

ACCESSORY = 1   # NSApplicationActivationPolicyAccessory: no Dock icon, not a regular application
VARIABLE_LENGTH = -1.0
app = send(c_void_p)(cls(b'NSApplication'), sel(b'sharedApplication'))
send(c_bool, c_long)(app, sel(b'setActivationPolicy:'), ACCESSORY)
bar = send(c_void_p)(cls(b'NSStatusBar'), sel(b'systemStatusBar'))
item = send(c_void_p, c_double)(bar, sel(b'statusItemWithLength:'), VARIABLE_LENGTH)
send(c_void_p)(item, sel(b'retain'))
button = send(c_void_p)(item, sel(b'button'))
loop = send(c_void_p)(cls(b'NSRunLoop'), sel(b'currentRunLoop'))

GREY, YELLOW, RED = '\\u26aa', '\\U0001f7e1', '\\U0001f534'
TIPS = {
    'free': 'webapp-evidence: nothing is recording - the machine is yours',
    'waiting': 'webapp-evidence: a take starts once the mouse and keyboard are left alone',
    'recording': 'webapp-evidence: recording - leave the mouse and keyboard alone',
}

def current():
    best = ('free', None)
    for lock in glob.glob(os.path.join(DIR, '*.lock')):
        try:
            holder = json.load(open(lock))
        except (OSError, ValueError):
            continue
        state = holder.get('screen')
        if state not in ('waiting', 'recording') or not alive(holder.get('pid')):
            continue
        if state == 'recording':
            return ('recording', None)
        best = ('waiting', holder.get('secondsLeft'))
    return best

shown = None
free_since = time.time()
try:
    while True:
        state, left = current()
        if (state, left) != shown:
            shown = (state, left)
            title = {'free': GREY, 'recording': RED}.get(state) or (
                '%s %s' % (YELLOW, left) if isinstance(left, int) else YELLOW)
            send(None, c_void_p)(button, sel(b'setTitle:'), nsstring(title))
            send(None, c_void_p)(button, sel(b'setToolTip:'), nsstring(TIPS[state]))
        if state != 'free':
            free_since = time.time()
        elif time.time() - free_since > IDLE_EXIT:
            break
        until = send(c_void_p, c_double)(cls(b'NSDate'), sel(b'dateWithTimeIntervalSinceNow:'), 0.25)
        send(None, c_void_p)(loop, sel(b'runUntilDate:'), until)
finally:
    if mine_or_none():
        try:
            os.unlink(PID_FILE)
        except OSError:
            pass
`;

// Put the item in the menu bar, unless one is already there. Never fails a take: the dot is a
// courtesy to the person at the machine, and the take does not depend on it.
function showStatusItem() {
  if (process.platform !== 'darwin') return;
  try {
    const running = Number(fs.readFileSync(PID_FILE, 'utf8'));
    if (isRunning(running)) return;
  } catch {
    // No item yet
  }
  try {
    fs.mkdirSync(DIR, { recursive: true });
    // Detached and unreferenced: it outlives this take on purpose, and must not keep the runner
    // from exiting when the take is done.
    const child = spawn(
      'python3',
      ['-c', PROGRAM, DIR, PID_FILE, String(IDLE_EXIT_SECONDS)],
      { detached: true, stdio: 'ignore' },
    );
    child.on('error', () => { /* no python3: no dot, and the take goes on */ });
    child.unref();
  } catch {
    // Same: the take goes on without it
  }
}

module.exports = { showStatusItem, PID_FILE };
