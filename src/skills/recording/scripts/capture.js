// What the frame of a recording is.
//
// The default is what the runner has always done: Playwright records the page. That runs
// headless, needs no permission and works in CI, and it is right for almost every take.
//
// It also cannot contain anything the operating system drew. On macOS the file picker is a
// sheet, a JavaScript dialog is tab-modal and the print dialog is a sheet — all of them inside
// the browser window and none of them in any page. So the other backend records that window,
// through ffmpeg, and cropping to the window rather than the display is what makes it usable:
// it catches everything a page recording misses and cannot catch the rest of somebody's desktop.
const fs = require('fs');
const path = require('path');
const { spawn, execFileSync } = require('child_process');

const PAGE = 'page';
const WINDOW = 'window';
const SCREEN = 'screen';
const MODES = [PAGE, WINDOW, SCREEN];

const CONSENT_ENV = 'SCREEN_CAPTURE';

// Recording the screen records whatever is on it, so it needs the operator's agreement — and the
// runner cannot ask for it. It is started by an agent through a shell, where a prompt on stdin
// waits forever. The agent holds the only channel to the person and passes this once they agree.
function assertConsent(mode, env = process.env) {
  if (mode === PAGE) return;
  if (env[CONSENT_ENV] === '1') return;
  throw new Error(
    `recording.capture is "${mode}", which records the screen rather than the page, and ${CONSENT_ENV}=1 is not set.\n` +
    'Everything visible on that screen ends up in the video. Ask the operator first, then pass ' +
    `${CONSENT_ENV}=1 to this command.\n` +
    'To record the page alone and keep running headless, set recording.capture to "page".'
  );
}

// `ffmpeg -f avfoundation -list_devices true` numbers cameras and screens in one list, so the
// index of a screen moves when a camera is plugged in. Reading it beats hardcoding a number that
// is right on the machine it was written on.
function parseScreenDevices(listing) {
  const devices = [];
  for (const line of String(listing).split('\n')) {
    const match = line.match(/\[(\d+)\]\s+Capture screen (\d+)/);
    if (match) devices.push({ index: Number(match[1]), display: Number(match[2]) });
  }
  return devices;
}

function screenDeviceIndex(display) {
  let listing = '';
  try {
    execFileSync('ffmpeg', ['-hide_banner', '-f', 'avfoundation', '-list_devices', 'true', '-i', ''],
      { encoding: 'utf8', stdio: ['ignore', 'ignore', 'pipe'] });
  } catch (error) {
    // Listing devices always exits non-zero: there is no input to open. The listing is on stderr.
    listing = String(error.stderr || '');
  }
  const devices = parseScreenDevices(listing);
  const found = devices.find((d) => d.display === display);
  if (!found) {
    throw new Error(
      `avfoundation has no "Capture screen ${display}".\n` +
      (devices.length
        ? `Available: ${devices.map((d) => `screen ${d.display}`).join(', ')}. Set recording.screenCapture.display.`
        : 'It lists no screens at all, which is what a machine with no display attached reports.')
    );
  }
  return found.index;
}

// avfoundation hands over physical pixels, so a rectangle measured in the page's own units has to
// be multiplied by the display's scale. On a Retina display, skipping that crops a quarter of the
// window — and nobody notices until the video is watched.
//
// h264 in yuv420p needs even dimensions, and an odd offset puts the chroma planes half a pixel
// out, so all four numbers are rounded to even.
function cropFor(rect, scale) {
  const even = (value) => Math.max(0, Math.round(value / 2) * 2);
  return {
    x: even(rect.x * scale),
    y: even(rect.y * scale),
    width: even(rect.width * scale),
    height: even(rect.height * scale),
  };
}

// ffmpeg does not start recording when it is spawned: it opens the device, negotiates a format,
// and only then writes a frame. Guessing that delay puts every timeline row and every caption out
// by a few hundred milliseconds, so the capture reports it instead — `-progress pipe:1` prints a
// block per frame, and the first one is the instant the recording actually began.
function createProgressReader(onFirstFrame) {
  let pending = '';
  let seen = false;
  return (chunk) => {
    pending += chunk;
    const lines = pending.split('\n');
    pending = lines.pop();          // a block can be cut in half between two reads
    for (const line of lines) {
      if (seen || !/^frame=\s*\d+/.test(line)) continue;
      seen = true;
      onFirstFrame();
    }
  };
}

// The operator is about to have their screen recorded, and they are probably not looking at the
// terminal the runner was started from. An AppleScript dialog floats above every application, so
// it is the one place a notice is certain to be seen. It dismisses itself, and the countdown that
// follows is time to move the mouse away before the first frame.
//
// This is a notice, not the consent: consent was given to the agent before the runner started,
// because a runner spawned through a shell has nobody to answer a prompt.
async function announce(countdownSeconds) {
  const message =
    'Screen recording is about to start.\n\n'
    + 'Please do not use this machine until it finishes, and turn on Do Not Disturb so a '
    + 'notification cannot appear in the video.';
  try {
    execFileSync('osascript', [
      '-e',
      `display dialog ${JSON.stringify(message)} buttons {"OK"} default button 1 `
      + 'with title "webapp-evidence" giving up after 6',
    ], { stdio: 'ignore' });
  } catch {
    // No windowing session, or automation is not permitted. The recording is still the operator's
    // own decision, already given, so a notice that could not be shown does not stop it.
  }
  await new Promise((r) => setTimeout(r, countdownSeconds * 1000));
}

// The rectangle to record, read from the browser rather than assumed. The window is placed at a
// known position, but the height of the browser's own chrome is not something the runner decides.
async function windowRect(page) {
  return page.evaluate(() => ({
    x: window.screenX,
    y: window.screenY,
    width: window.outerWidth,
    height: window.outerHeight,
    chromeHeight: window.outerHeight - window.innerHeight,
    scale: window.devicePixelRatio,
  }));
}

function createCapture({ mode = PAGE, outDir, name, settings, viewport }) {
  if (!MODES.includes(mode)) {
    throw new Error(`recording.capture is invalid: ${JSON.stringify(mode)}\nUse one of ${MODES.join(' | ')}.`);
  }
  assertConsent(mode);

  const screen = settings.screenCapture;
  let page = null;
  let context = null;
  let ffmpeg = null;
  let rect = null;
  // What the capture writes is not what is handed over: the encode reads it, applies whatever
  // was redacted and the configured quality, and deletes it.
  const file = path.join(outDir, mode === PAGE ? `${name}.webm` : `${name}.raw.mp4`);
  let openedAt = null;

  return {
    mode,

    // Playwright has to be told at context creation, before anything has been recorded
    contextOptions: () => (mode === PAGE ? { recordVideo: { dir: outDir, size: viewport } } : {}),

    attach(parts) {
      page = parts.page;
      context = parts.context;
      // Playwright is already recording by the time the page exists, so this is where its clock
      // starts. The page-load wait that follows is trimmed off at encode time.
      openedAt = Date.now();
    },

    // The rectangle of the frame in page coordinates, so the runner knows what a screenshot
    // shares with the video. Null until the capture has started.
    rect: () => rect,

    // Returns the origin every timestamp in the take is measured from, and how much of the front
    // to cut off. They differ by backend: Playwright has been recording since the page existed,
    // so the load has to be trimmed; ffmpeg is started once the page is ready, so there is
    // nothing in front to remove.
    async start() {
      if (mode === PAGE) {
        return { startedAt: openedAt, trimAt: (Date.now() - openedAt) / 1000 };
      }

      await announce(screen.countdownSeconds);

      const geometry = await windowRect(page);
      rect = mode === WINDOW
        ? { x: geometry.x, y: geometry.y, width: geometry.width, height: geometry.height }
        : null;
      const crop = rect ? cropFor(rect, geometry.scale) : null;
      const device = screenDeviceIndex(screen.display);

      const args = [
        '-y', '-v', 'error',
        '-f', 'avfoundation',
        // The real pointer never moves: Playwright dispatches its clicks through the browser, so
        // capturing the cursor would record it sitting wherever the operator last left it. The
        // cursor in the video is the one the runner draws into the page.
        '-capture_cursor', '0',
        '-framerate', String(screen.framerate),
        '-i', `${device}:none`,
        ...(crop ? ['-vf', `crop=${crop.width}:${crop.height}:${crop.x}:${crop.y}`] : []),
        // Captured in real time, so the encoder must never be the bottleneck; the take is
        // re-encoded to the configured quality afterwards, along with any redactions.
        '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '18', '-pix_fmt', 'yuv420p',
        '-progress', 'pipe:1', '-nostats',
        file,
      ];

      return new Promise((resolve, reject) => {
        ffmpeg = spawn('ffmpeg', args, { stdio: ['pipe', 'pipe', 'pipe'] });
        let stderr = '';
        const read = createProgressReader(() => resolve({ startedAt: Date.now(), trimAt: 0 }));

        ffmpeg.stdout.on('data', (d) => read(String(d)));
        ffmpeg.stderr.on('data', (d) => { stderr += String(d); });
        ffmpeg.on('exit', (code) => {
          ffmpeg = null;
          reject(new Error(
            `The screen capture stopped before it recorded a frame (exit ${code}).\n${stderr.trim()}`
          ));
        });
        ffmpeg.on('error', reject);
      });
    },

    async stop() {
      if (mode === PAGE) {
        const video = page.video();
        await context.close();
        const raw = await video.path();
        fs.renameSync(raw, file);
        return { file };
      }

      const running = ffmpeg;
      ffmpeg = null;
      await new Promise((resolve) => {
        if (!running) { resolve(); return; }
        running.removeAllListeners('exit');
        running.on('exit', resolve);
        // `q` lets ffmpeg write the index; killing it leaves a file that will not seek and may
        // not play at all.
        try { running.stdin.write('q'); } catch { running.kill('SIGINT'); }
      });
      await context.close();
      return { file };
    },
  };
}

module.exports = {
  createCapture, assertConsent, parseScreenDevices, cropFor, createProgressReader,
  MODES, PAGE, WINDOW, SCREEN, CONSENT_ENV,
};
