// The plugin's firefly in the menu bar while screen takes are being made, its lantern lit by what
// is happening, its rays flashing once a second:
//
//   orange + seconds  a take starts, or carries on, once the mouse and keyboard are left alone
//   red               recording: leave the mouse and keyboard alone
//   green             between takes: the machine is the person's, and another take may follow
//
// While there are seconds, a frame holds the firefly and them together. The firefly leaves once
// BETWEEN_TAKES_SECONDS have passed with no take; no firefly means nothing is about to happen.
//
// Between two takes the runner is not running at all — a step failed, the agent is rewriting the
// script — and nothing on the screen used to say so. The person either sat waiting, or went back
// to work and had the machine taken from them when the next take began. Green is that gap: the
// runner cannot know whether the agent will record again, so it says the machine is free for now.
//
// The state is read from the lock each take already holds (lock.js), which the runner adds the
// state to: a run that crashed leaves a lock whose process is gone, and that reads as no take —
// green, then gone — rather than as a red light nobody will ever put out. One item for the whole machine, whichever
// project is recording.
//
// The drawing is the favicon's, from assets/firefly-mark.json — written by
// docs/images/logo/build-firefly-assets.py, so the two cannot drift apart, with a larger lantern
// and the full logo's rays so the light can be seen at menu bar size. The body is drawn in the
// brand's ink for the menu bar's appearance, as every other item there is one flat colour.
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

const LIGHT = { waiting: '#F5820B', recording: '#EF3B2D', between: '#2FB344' };

// How long a fresh item waits for the take that started it to write its first state, before it
// concludes there is no take and leaves.
const FIRST_STATE_SECONDS = 15;
// How long green stays after a take: long enough to span an agent fixing a step script and
// recording again, short enough that a session that has moved on does not keep a light on.
const BETWEEN_TAKES_SECONDS = 10 * 60;

const PROGRAM = `
ObjC.import('AppKit');
ObjC.bindFunction('kill', ['int', ['int', 'int']]);
ObjC.bindFunction('getpid', ['int', []]);

function run(argv) {
  var DIR = argv[0], PID_FILE = argv[1], MARK = JSON.parse(argv[2]), LIGHT = JSON.parse(argv[3]);
  var FIRST_STATE = Number(argv[4]), BETWEEN_TAKES = Number(argv[5]);
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

  function hex(h, alpha) {
    var n = parseInt(h.slice(1), 16);
    return $.NSColor.colorWithSRGBRedGreenBlueAlpha(
      (n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255, alpha === undefined ? 1 : alpha);
  }
  // The frame is a light grey on either appearance: the ink, faded
  var FRAME_ALPHA = 0.35;
  var BOX_X = MARK.box[0], BOX_Y = MARK.box[1], BOX = MARK.box[2];
  function polygon(pts, k) {   // SVG y grows downward, AppKit's upward
    var p = $.NSBezierPath.bezierPath;
    for (var i = 0; i < pts.length; i += 2) {
      var pt = $.NSMakePoint((pts[i] - BOX_X) * k, (BOX - (pts[i + 1] - BOX_Y)) * k);
      if (i === 0) p.moveToPoint(pt); else p.lineToPoint(pt);
    }
    p.closePath;
    return p;
  }
  // One image for the firefly, the seconds beside it and a frame round both, so they read as one
  // thing rather than as an icon with some number next to it. With no seconds there is nothing to
  // hold together: no frame, and the firefly takes the room the frame took. Drawn at three times
  // the size it is shown at, so it stays sharp on any display.
  var HEIGHT = 22, GAP = 1, SCALE = 3;
  var FRAMED = { mark: 17, pad: 4 }, BARE = { mark: 21, pad: 0 };
  var font = $.NSFont.monospacedDigitSystemFontOfSizeWeight(12 * SCALE, $.NSFontWeightSemibold);
  var cache = {};
  function badge(ink, light, rays, text) {
    var key = [ink, light, rays, text].join('|');
    if (cache[key]) return cache[key];
    var attrs = $({ NSFont: font, NSColor: hex(ink) });
    var label = $(text);
    var textSize = text ? label.sizeWithAttributes(attrs) : { width: 0, height: 0 };
    var layout = text ? FRAMED : BARE, MARK_SIZE = layout.mark, PAD = layout.pad;
    var width = PAD + MARK_SIZE + (text ? GAP + textSize.width / SCALE : 0) + PAD;
    var pxW = Math.ceil(width * SCALE), pxH = HEIGHT * SCALE;
    var rep = $.NSBitmapImageRep.alloc.initWithBitmapDataPlanesPixelsWidePixelsHighBitsPerSampleSamplesPerPixelHasAlphaIsPlanarColorSpaceNameBytesPerRowBitsPerPixel(
      null, pxW, pxH, 8, 4, true, false, 'NSDeviceRGBColorSpace', 0, 0);
    var ctx = $.NSGraphicsContext.graphicsContextWithBitmapImageRep(rep);
    $.NSGraphicsContext.saveGraphicsState;
    $.NSGraphicsContext.setCurrentContext(ctx);

    var frame = $.NSBezierPath.bezierPathWithRoundedRectXRadiusYRadius(
      $.NSMakeRect(SCALE, SCALE, pxW - 2 * SCALE, pxH - 2 * SCALE), 5 * SCALE, 5 * SCALE);
    frame.setLineWidth(1.2 * SCALE);
    hex(ink, FRAME_ALPHA).set;
    if (text) frame.stroke;
    hex(ink).set;

    var k = MARK_SIZE * SCALE / BOX, dx = PAD * SCALE, dy = (pxH - MARK_SIZE * SCALE) / 2;
    function shape(pts) {
      var p = polygon(pts, k);
      var move = $.NSAffineTransform.transform;
      move.translateXByYBy(dx, dy);
      p.transformUsingAffineTransform(move);
      p.fill;
    }
    MARK.body.forEach(shape);
    hex(light).set;
    shape(MARK.lantern);
    if (rays) MARK.rays.forEach(shape);

    if (text) {
      label.drawAtPointWithAttributes(
        $.NSMakePoint((PAD + MARK_SIZE + GAP) * SCALE, (pxH - textSize.height) / 2), attrs);
    }
    ctx.flushGraphics;
    $.NSGraphicsContext.restoreGraphicsState;
    rep.setSize($.NSMakeSize(width, HEIGHT));
    var image = $.NSImage.alloc.initWithSize($.NSMakeSize(width, HEIGHT));
    image.addRepresentation(rep);
    return (cache[key] = image);
  }

  var TIPS = {
    waiting: 'Webapp Evidence: a take starts once the mouse and keyboard are left alone',
    recording: 'Webapp Evidence: recording - leave the mouse and keyboard alone',
    between: 'Webapp Evidence: between takes - the machine is yours; another take may follow',
  };

  $.NSApplication.sharedApplication.setActivationPolicy($.NSApplicationActivationPolicyAccessory);
  var item = null, shown = null, startedAt = Date.now(), lastTakeAt = null;
  try {
    for (;;) {
      var now = current();
      if (now) {
        lastTakeAt = Date.now();
      } else if (lastTakeAt === null) {
        if (Date.now() - startedAt > FIRST_STATE * 1000) break;
      } else if (Date.now() - lastTakeAt > BETWEEN_TAKES * 1000) {
        break;
      } else {
        now = { state: 'between' };
      }
      if (now) {
        if (!item) {
          item = $.NSStatusBar.systemStatusBar.statusItemWithLength($.NSVariableStatusItemLength);
        }
        var button = item.button;
        var dark = button.effectiveAppearance.bestMatchFromAppearancesWithNames(
          $(['NSAppearanceNameAqua', 'NSAppearanceNameDarkAqua'])).js === 'NSAppearanceNameDarkAqua';
        var ink = dark ? MARK.ink.dark : MARK.ink.light;
        // The rays flash once a second in every state, the way a recording light does
        var rays = Math.floor(Date.now() / 500) % 2 === 0;
        var text = now.state === 'waiting' && typeof now.left === 'number' ? String(now.left) : '';
        var look = [ink, rays, text, now.state].join('|');
        if (look !== shown) {
          shown = look;
          button.setImage(badge(ink, LIGHT[now.state], rays, text));
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
      DIR, PID_FILE, JSON.stringify(MARK), JSON.stringify(LIGHT), String(FIRST_STATE_SECONDS),
      String(BETWEEN_TAKES_SECONDS),
    ], { detached: true, stdio: 'ignore' });
    child.on('error', () => { /* no item, and the take goes on */ });
    child.unref();
  } catch {
    // Same: the take goes on without it
  }
}

module.exports = { showStatusItem, PID_FILE };
