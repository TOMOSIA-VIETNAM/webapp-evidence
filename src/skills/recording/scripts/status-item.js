// The plugin's firefly in the menu bar for as long as a screen take holds the machine, the whole
// of it coloured by what the take is doing:
//
//   amber + seconds  the take starts, or carries on, once the mouse and keyboard are left alone
//   red, lantern pulsing  recording: leave the mouse and keyboard alone
//
// and gone once the take is over. No firefly means nothing is about to move the pointer.
//
// Between two takes the runner is not running at all — a step failed, the agent is rewriting the
// script — and nothing on the screen used to say so. The person either sat waiting, or went back
// to work and had the machine taken from them when the next take began.
//
// The state is read from the lock each take already holds (lock.js), which the runner adds the
// state to: a run that crashed leaves a lock whose process is gone, and that reads as no take
// rather than as a red light nobody will ever put out. One item for the whole machine, whichever
// project is recording.
//
// The drawing is the favicon's, from assets/firefly-mark.json — written by
// docs/images/logo/build-firefly-assets.py, so the two cannot drift apart. Coloured whole rather
// than as one lit lantern: at menu bar size the lantern alone is a few pixels, too small to tell
// amber from red at a glance. The lantern is a lighter tone of the body's colour, as in the logo.
//
// AppKit through JavaScript for Automation (`osascript -l JavaScript`): nothing installed. The
// process is an accessory application, with no Dock icon, which also keeps desktop.js from hiding
// it.
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { DIR, isRunning } = require('./lock');
const MARK = require('../assets/firefly-mark.json');

const PID_FILE = path.join(DIR, 'status-item.pid');

// Body and lantern, per state. Recording alternates its lantern between the two tones.
const TONES = {
  waiting: { body: '#D2690A', lantern: '#FFB21F' },
  recording: { body: '#E0362B', lantern: '#FF7D6E' },
  recordingDim: { body: '#E0362B', lantern: '#E0362B' },
};

// How long a fresh item waits for the take that started it to write its first state, before it
// concludes there is no take and leaves.
const FIRST_STATE_SECONDS = 15;

const PROGRAM = `
ObjC.import('AppKit');
ObjC.bindFunction('kill', ['int', ['int', 'int']]);
ObjC.bindFunction('getpid', ['int', []]);

function run(argv) {
  var DIR = argv[0], PID_FILE = argv[1], MARK = JSON.parse(argv[2]), TONES = JSON.parse(argv[3]);
  var FIRST_STATE = Number(argv[4]);
  var files = $.NSFileManager.defaultManager;

  function read(file) {
    var text = $.NSString.stringWithContentsOfFileEncodingError(file, $.NSUTF8StringEncoding, null);
    return text.isNil() ? null : text.js;
  }
  function alive(pid) { return typeof pid === 'number' && pid > 0 && $.kill(pid, 0) === 0; }

  var other = Number(read(PID_FILE));
  if (other && other !== $.getpid() && alive(other)) return;   // another one is already showing
  $(String($.getpid())).writeToFileAtomicallyEncodingError(PID_FILE, true, $.NSUTF8StringEncoding, null);

  // The take most in need of hands off, across every project: recording over waiting.
  function current() {
    var names = files.contentsOfDirectoryAtPathError(DIR, null);
    var found = null;
    for (var i = 0; names && i < names.count; i++) {
      var name = names.objectAtIndex(i).js;
      if (!/\\.lock$/.test(name)) continue;
      var holder;
      try { holder = JSON.parse(read(DIR + '/' + name)); } catch (e) { continue; }
      if (!holder || (holder.screen !== 'waiting' && holder.screen !== 'recording')) continue;
      if (!alive(holder.pid)) continue;
      if (holder.screen === 'recording') return { state: 'recording' };
      found = { state: 'waiting', left: holder.secondsLeft };
    }
    return found;
  }

  function hex(h) {
    var n = parseInt(h.slice(1), 16);
    return $.NSColor.colorWithSRGBRedGreenBlueAlpha((n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255, 1);
  }
  function polygon(pts, k) {   // SVG y grows downward, AppKit's upward
    var p = $.NSBezierPath.bezierPath;
    for (var i = 0; i < pts.length; i += 2) {
      var pt = $.NSMakePoint(pts[i] * k, (MARK.viewBox - pts[i + 1]) * k);
      if (i === 0) p.moveToPoint(pt); else p.lineToPoint(pt);
    }
    p.closePath;
    return p;
  }
  // Drawn at three times the size it is shown at, so it stays sharp on any display
  var POINTS = 18;
  var cache = {};
  function firefly(tones) {
    var key = tones.body + tones.lantern;
    if (cache[key]) return cache[key];
    var px = POINTS * 3, k = px / MARK.viewBox;
    var rep = $.NSBitmapImageRep.alloc.initWithBitmapDataPlanesPixelsWidePixelsHighBitsPerSampleSamplesPerPixelHasAlphaIsPlanarColorSpaceNameBytesPerRowBitsPerPixel(
      null, px, px, 8, 4, true, false, 'NSDeviceRGBColorSpace', 0, 0);
    var ctx = $.NSGraphicsContext.graphicsContextWithBitmapImageRep(rep);
    $.NSGraphicsContext.saveGraphicsState;
    $.NSGraphicsContext.setCurrentContext(ctx);
    hex(tones.body).set;
    MARK.body.forEach(function (shape) { polygon(shape, k).fill; });
    hex(tones.lantern).set;
    polygon(MARK.lantern, k).fill;
    ctx.flushGraphics;
    $.NSGraphicsContext.restoreGraphicsState;
    rep.setSize($.NSMakeSize(POINTS, POINTS));
    var image = $.NSImage.alloc.initWithSize($.NSMakeSize(POINTS, POINTS));
    image.addRepresentation(rep);
    return (cache[key] = image);
  }

  var TIPS = {
    waiting: 'Webapp Evidence: a take starts once the mouse and keyboard are left alone',
    recording: 'Webapp Evidence: recording - leave the mouse and keyboard alone',
  };

  $.NSApplication.sharedApplication.setActivationPolicy($.NSApplicationActivationPolicyAccessory);
  var item = null, shown = null, startedAt = Date.now(), seen = false;
  try {
    for (;;) {
      var now = current();
      if (!now) {
        if (seen || Date.now() - startedAt > FIRST_STATE * 1000) break;
      } else {
        seen = true;
        if (!item) {
          item = $.NSStatusBar.systemStatusBar.statusItemWithLength($.NSVariableStatusItemLength);
          item.button.setImagePosition($.NSImageLeft);
          item.button.setFont($.NSFont.monospacedDigitSystemFontOfSizeWeight(0, 0));
        }
        var button = item.button;
        // Recording pulses once a second, the way a recording light does
        var tones = now.state === 'waiting' ? TONES.waiting
          : (Math.floor(Date.now() / 500) % 2 ? TONES.recordingDim : TONES.recording);
        var title = now.state === 'waiting' && typeof now.left === 'number' ? ' ' + now.left : '';
        var look = [tones.lantern, title, now.state].join('|');
        if (look !== shown) {
          shown = look;
          button.setImage(firefly(tones));
          button.setTitle(title);
          button.setToolTip(TIPS[now.state]);
        }
      }
      $.NSRunLoop.currentRunLoop.runUntilDate($.NSDate.dateWithTimeIntervalSinceNow(0.1));
    }
  } finally {
    if (item) $.NSStatusBar.systemStatusBar.removeStatusItem(item);
    if (Number(read(PID_FILE)) === $.getpid()) files.removeItemAtPathError(PID_FILE, null);
  }
}
`;

// Put the firefly in the menu bar for this take, unless one is already there. Never fails a take:
// it is a courtesy to the person at the machine, and the take does not depend on it.
function showStatusItem() {
  if (process.platform !== 'darwin') return;
  try {
    if (isRunning(Number(fs.readFileSync(PID_FILE, 'utf8')))) return;
  } catch {
    // No item yet
  }
  try {
    fs.mkdirSync(DIR, { recursive: true });
    // Detached and unreferenced: the take must not wait for it to exit, and it leaves on its own
    // once no take holds the machine.
    const child = spawn('osascript', [
      '-l', 'JavaScript', '-e', PROGRAM,
      DIR, PID_FILE, JSON.stringify(MARK), JSON.stringify(TONES), String(FIRST_STATE_SECONDS),
    ], { detached: true, stdio: 'ignore' });
    child.on('error', () => { /* no item, and the take goes on */ });
    child.unref();
  } catch {
    // Same: the take goes on without it
  }
}

module.exports = { showStatusItem, PID_FILE };
