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
const os = require('os');
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
// out, so all four numbers are made even. Downwards, never up: a rectangle rounded outwards can
// end a pixel past the edge of the captured frame, and ffmpeg refuses a crop that does — after
// the take has already been recorded. `bounds`, the size of the display, clamps the same way.
function cropFor(rect, scale, bounds) {
  const down = (value) => Math.max(0, Math.floor(value / 2) * 2);
  const limit = bounds && { width: down(bounds.width * scale), height: down(bounds.height * scale) };

  const x = down(rect.x * scale);
  const y = down(rect.y * scale);
  let width = down(rect.width * scale);
  let height = down(rect.height * scale);
  if (limit) {
    width = Math.min(width, down(limit.width - x));
    height = Math.min(height, down(limit.height - y));
  }
  return { x, y, width, height };
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

// A window taller than the display is not an error anyone sees: macOS places it anyway, with the
// bottom of it off the screen, and the capture records what is left. The result is a video of a
// clipped application that looks like the application is clipped.
//
// The viewport is part of the evidence — two takes are compared against each other — so this
// refuses rather than quietly choosing a smaller one, and says which number to change.
function assertWindowFits(geometry, usable) {
  const { chromeHeight } = geometry;
  const overflowsRight = geometry.x + geometry.width > usable.x + usable.width + 1;
  const overflowsBottom = geometry.y + geometry.height > usable.y + usable.height + 1;
  if (!overflowsRight && !overflowsBottom) return;

  const fitsHeight = Math.floor(usable.height - chromeHeight);
  const fitsWidth = Math.floor(usable.width);
  throw new Error(
    'The browser window does not fit on this display, so a window capture would record a ' +
    'clipped one.\n'
    + `  the window needs   ${Math.round(geometry.width)}x${Math.round(geometry.height)} `
    + `at ${Math.round(geometry.x)},${Math.round(geometry.y)}\n`
    + `  the display offers ${usable.width}x${usable.height} at ${usable.x},${usable.y}\n`
    + `Set recording.viewport to ${fitsWidth}x${fitsHeight} or smaller — the browser's own `
    + `chrome adds ${Math.round(chromeHeight)}px on top of it — or record on a larger display.`
  );
}

// Where the window is, in the units the page uses. These four are real: Playwright does not
// touch the size or position of the window it opened.
async function windowRect(page) {
  return page.evaluate(() => ({
    x: window.screenX,
    y: window.screenY,
    width: window.outerWidth,
    height: window.outerHeight,
    chromeHeight: window.outerHeight - window.innerHeight,
  }));
}

// The display, which the recorded page cannot be asked about.
//
// A context with a viewport emulates `window.screen` to match it, and `devicePixelRatio` is
// pinned to 1 by the recording context, so both come back describing the recording rather than
// the machine. Read together they are wrong in a way that looks right: on this repository's own
// check they produced a crop of the top-left quarter of the window that passed every assertion.
//
// A context with no viewport emulates nothing, so its page reports the display.
async function displayMetrics(page) {
  const context = await page.context().browser().newContext({ viewport: null });
  try {
    const probe = await context.newPage();
    return await probe.evaluate(() => ({
      width: window.screen.width,
      height: window.screen.height,
      usable: {
        x: window.screen.availLeft ?? 0,
        y: window.screen.availTop ?? 0,
        width: window.screen.availWidth,
        height: window.screen.availHeight,
      },
    }));
  } finally {
    await context.close();
  }
}

// One frame from the device, which settles two questions at once: how many physical pixels the
// display actually has — the scale follows from that, rather than from a devicePixelRatio the
// recording context has already overwritten — and whether this machine will hand over a screen
// capture at all.
function probeDevice(device) {
  const probe = path.join(os.tmpdir(), `evidence-capture-probe-${process.pid}.png`);
  try {
    execFileSync('ffmpeg', [
      '-y', '-v', 'error', '-f', 'avfoundation', '-capture_cursor', '0',
      '-framerate', '30', '-i', `${device}:none`, '-frames:v', '1', probe,
    ], { stdio: ['ignore', 'ignore', 'pipe'] });
    const size = execFileSync('ffprobe', [
      '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height',
      '-of', 'csv=p=0', probe,
    ], { encoding: 'utf8' }).trim().split(',').map(Number);
    return { width: size[0], height: size[1] };
  } catch (error) {
    throw new Error(
      'This machine did not hand over a screen capture.\n' +
      `${String(error.stderr || error.message).trim()}\n\n` +
      'On macOS this is usually Screen Recording permission: System Settings > Privacy & ' +
      'Security > Screen Recording, for the application running this command, then start it again.'
    );
  } finally {
    try { fs.unlinkSync(probe); } catch { /* nothing to clean up */ }
  }
}

// Stopping a recorder, with an escalation rather than a single hopeful signal.
//
// `q` is the polite way and works for most inputs. avfoundation is not one of them: the capture
// device holds ffmpeg somewhere it reads neither its own input nor an interrupt, so on macOS
// every take ends at the last step. Waiting for the polite one alone means the take is finished,
// the runner is idle, and the screen carries on being recorded until somebody notices.
//
// The waits are short because the last step is the expected one here, not a disaster: the
// capture is written in fragments that are flushed as they are made, so a killed recorder still
// leaves a video that plays.
const STOP_QUIET_MS = 2000;
const STOP_TERM_MS = 2000;

function stopRecorder(child, { quietMs = STOP_QUIET_MS, termMs = STOP_TERM_MS } = {}) {
  return new Promise((resolve) => {
    let settled = false;
    let by = 'q';
    const timers = [];
    const finish = () => {
      if (settled) return;
      settled = true;
      timers.forEach(clearTimeout);
      resolve(by);
    };

    child.removeAllListeners('exit');
    child.on('exit', finish);

    try {
      child.stdin.write('q');
    } catch {
      by = 'interrupt';
      try { child.kill('SIGINT'); } catch { finish(); }
    }

    timers.push(setTimeout(() => {
      by = 'interrupt';
      try { child.kill('SIGINT'); } catch { finish(); }
    }, quietMs));
    timers.push(setTimeout(() => {
      by = 'kill';
      try { child.kill('SIGKILL'); } catch { finish(); }
    }, quietMs + termMs));
  });
}

// The one thing that matters about the file the recorder left behind. Checked here rather than
// inferred from how it was stopped, and before the encode fails on it with a message about
// atoms that says nothing about screen recording.
function assertReadable(file, stoppedBy) {
  try {
    execFileSync('ffprobe', [
      '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width', '-of', 'csv=p=0', file,
    ], { stdio: ['ignore', 'ignore', 'pipe'] });
  } catch (error) {
    throw new Error(
      `The screen recording at ${file} cannot be read back (the recorder was stopped by ` +
      `${stoppedBy}).\n${String(error.stderr || '').trim()}`
    );
  }
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
  let scale = 1;
  let endedEarly = false;
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

    // What was recorded, in the page's own units, and how many physical pixels there are to each
    // of them. Null until the capture has started. The runbook carries both: they are what
    // someone checking the video can measure it against.
    frame: () => (rect ? { ...rect, scale } : null),

    // Returns the origin every timestamp in the take is measured from, and how much of the front
    // to cut off. They differ by backend: Playwright has been recording since the page existed,
    // so the load has to be trimmed; ffmpeg is started once the page is ready, so there is
    // nothing in front to remove.
    async start() {
      if (mode === PAGE) {
        return { startedAt: openedAt, trimAt: (Date.now() - openedAt) / 1000 };
      }

      await announce(screen.countdownSeconds);

      const device = screenDeviceIndex(screen.display);
      const display = await displayMetrics(page);
      const captured = probeDevice(device);

      // Not devicePixelRatio: the recording context pins that to 1. The only honest ratio is
      // between what the device hands over and what the display measures.
      scale = captured.width / display.width;

      const geometry = await windowRect(page);
      if (mode === WINDOW) assertWindowFits(geometry, display.usable);
      rect = mode === WINDOW
        ? { x: geometry.x, y: geometry.y, width: geometry.width, height: geometry.height }
        : { x: 0, y: 0, width: display.width, height: display.height };
      const crop = mode === WINDOW ? cropFor(rect, scale, display) : null;

      // The second window opened to measure the display took the focus with it
      await page.bringToFront();

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
        // avfoundation timestamps every frame off a microsecond clock and ignores the framerate
        // asked of it, so without this the output claims a million frames a second: a take that
        // ran for twenty seconds becomes a file seven milliseconds long, which no player and no
        // timeline in the runbook can make sense of. Resampling to a constant rate on the way
        // out is what gives the file a duration that matches the wall clock.
        '-fps_mode', 'cfr', '-r', String(screen.framerate),
        // Captured in real time, so the encoder must never be the bottleneck; the take is
        // re-encoded to the configured quality afterwards, along with any redactions.
        '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '18', '-pix_fmt', 'yuv420p',
        // Written so that killing the recorder still leaves a video that plays.
        //
        // This is not a nicety. avfoundation ignores both the stop request and an interrupt —
        // the capture device holds ffmpeg somewhere neither reaches — so every take on macOS
        // ends by killing it. An ordinary mp4 keeps its index in memory until the process
        // exits cleanly, and a killed one has no index at all: a recording with nothing
        // wrong with it that no player will open.
        //
        // Fragments carry their own index, and `-flush_packets` is what puts them on disk as
        // they are made rather than at the end. Without that flag the fragments never reach
        // the file and the result is exactly as unreadable.
        '-movflags', '+frag_keyframe+empty_moov', '-frag_duration', '500000',
        '-flush_packets', '1',
        // A cap on the whole recording, so a runner that dies partway cannot leave a screen
        // recorder running until the disk fills.
        '-t', String(screen.maxSeconds),
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
          // Before the first frame this is a failure to start. After it, the recorder hit its own
          // time limit while the take was still running, which stop() turns into an error rather
          // than handing over a video that ends in the middle of the flow.
          endedEarly = true;
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
      const stoppedBy = running ? await stopRecorder(running) : 'q';
      await context.close();

      // Whether it stopped politely or had to be killed does not decide this — the fragmented
      // output is meant to survive either. What decides it is whether the file can be read, so
      // that is what is checked, before the encode reports the same thing less clearly.
      assertReadable(file, stoppedBy);

      if (endedEarly) {
        throw new Error(
          `The screen recording stopped on its own after recording.screenCapture.maxSeconds ` +
          `(${screen.maxSeconds}s), so the take is cut short.\n` +
          'Raise that limit for a longer take, or shorten the step script.'
        );
      }
      return { file };
    },
  };
}

module.exports = {
  createCapture, assertConsent, assertReadable, assertWindowFits, parseScreenDevices, cropFor,
  createProgressReader, stopRecorder,
  MODES, PAGE, WINDOW, SCREEN, CONSENT_ENV,
};
