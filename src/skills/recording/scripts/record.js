#!/usr/bin/env node
// Evidence recording runner for an MR: operation video + screenshots + timeline.
// Usage: OUT_DIR=<directory> node record.js <steps-file>   (see --help)
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const {
  HELP_ENV, sleep, watchProblems, assertOutsideSkill, resolveSettings,
  loadProjectConfig, resolveApp, launchBrowser, prepareApp, signIn, makeAccountStore, ROOT,
} = require('./session');
const { createHuman, resolvePause } = require('./human');
const { createCaptions } = require('./captions');
const { createTerminal, isBehindPanel } = require('./terminal');
const {
  createRedactions, buildFilter, shiftTime, unionBox, padBox,
} = require('./redaction');
const { createCapture } = require('./capture');

const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

// Playwright's key names ('ControlOrMeta+C') are not what a viewer reads off their own keyboard.
// The key hint overlay in the video shows the symbols of the operating system doing the recording:
// a Mac shows ⌘, a Windows/Linux machine shows Ctrl.
const IS_MAC = process.platform === 'darwin';
const MODIFIER_CAPS = IS_MAC
  ? { Meta: '\u2318', ControlOrMeta: '\u2318', Control: '\u2303', Alt: '\u2325', Shift: '\u21e7' }
  : { Meta: 'Win', ControlOrMeta: 'Ctrl', Control: 'Ctrl', Alt: 'Alt', Shift: 'Shift' };
const NAMED_CAPS = {
  Escape: 'Esc', Enter: 'Enter', Tab: 'Tab', Backspace: 'Backspace', Delete: 'Delete',
  ArrowUp: '\u2191', ArrowDown: '\u2193', ArrowLeft: '\u2190', ArrowRight: '\u2192', Space: 'Space',
};

function keyCaps(keys) {
  return String(keys).split('+').map((raw) => {
    const key = raw.trim();
    if (!key) throw new Error(`Invalid shortcut key string: ${JSON.stringify(keys)}`);
    return MODIFIER_CAPS[key] || NAMED_CAPS[key] || (key.length === 1 ? key.toUpperCase() : key);
  });
}

function help() {
  console.log(`Record evidence for an MR: operation video + screenshots + timeline.

  OUT_DIR=<directory> node record.js <steps-file>

    <steps-file>      Step script for the screen. Example: ${path.join(__dirname, '../assets/steps.example.js')}
    OUT_DIR           Directory the results are written to (required)
    VIDEO_NAME        Video/runbook file name (defaults to the name in the step script)
    CAPTIONS          on|off — captions in the video (default on)
    CAPTION_LOCALE    Caption language: en | ja | vi (default en)

${HELP_ENV}

Output: <name>.mp4, <name>-runbook.md and the screenshots numbered in capture order.
The page-load wait at the start is trimmed off the video; the sign-in step is not recorded.`);
}

// ---------- interaction helpers ----------
// How long to leave a caption up. A fixed hold suits one sentence length and no other: short ones
// sit there long after they have been read, long ones vanish before they have. So the hold follows
// the reading rather than the clock — a floor for noticing that something appeared, plus time
// proportional to the text, capped so one long caption cannot stall the take.
//
// CJK runs at a slower character rate because a character there carries far more than a letter
// does: the same second of reading covers fewer of them.
const CJK = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/g;

function readingTime(text, pace) {
  const characters = String(text).length;
  const dense = (String(text).match(CJK) ?? []).length > characters / 4;
  const perSecond = dense ? pace.noteCjkCharsPerSec : pace.noteCharsPerSec;
  return Math.round(Math.min(pace.noteHoldMs + (characters / perSecond) * 1000, pace.noteHoldMaxMs));
}

// The mouse interpolates its way over before clicking, so the viewer can see where the click lands
function buildContext({
  page, outDir, marks, hotkeys, notes, dialogs, startedAt, pace, viewport, human, captions,
  terminal, redactions, capturesBrowserUi,
}) {
  const mark = (label) => marks.push({ at: (Date.now() - startedAt) / 1000, label });
  const since = () => (Date.now() - startedAt) / 1000;

  // The redaction window a step is inside, if any: shot() has to know, and it is set here rather
  // than passed down because every helper between the two would otherwise have to carry it.
  let active = null;

  // Every move/keypress command makes a round trip to the browser. Sleeping the full `delay` AFTER
  // each round trip makes the action run 30–40% longer than intended, and that is exactly the
  // "why is it waiting so long" feeling. So sleep until the computed timestamp, not by amount.
  function scheduler() {
    const from = Date.now();
    let planned = 0;
    return async (delay) => {
      planned += delay;
      const behind = planned - (Date.now() - from);
      if (behind > 0) await sleep(behind);
    };
  }

  async function moveTo(x, y, targetSize) {
    const from = page.__cursor || human.restingPoint();
    const plan = human.movePlan(from, { x, y }, targetSize);
    page.__cursor = { x, y };
    if (!plan) return 0;

    // Interpolate against the wall clock: how many frames get drawn depends on how fast the browser
    // is, but the movement always finishes at the moment it was meant to.
    const startedMove = Date.now();
    for (;;) {
      const frameAt = Date.now();
      const progress = (frameAt - startedMove) / plan.duration;
      if (progress >= 1) break;
      const point = plan.at(progress);
      await page.mouse.move(point.x, point.y);
      const idle = plan.frameMs - (Date.now() - frameAt);
      if (idle > 0) await sleep(idle);
    }
    await page.mouse.move(x, y);
    return Math.hypot(x - from.x, y - from.y);
  }

  async function click(locator, { pause } = {}) {
    // scrollIntoViewIfNeeded costs about 64ms per call. Skip it when the element is already inside
    // the frame: a run of clicks within the same screen is not slowed down by work nobody needs.
    let box = await locator.boundingBox();
    const inView = box
      && box.y >= 0 && box.y + box.height <= viewport.height
      && box.x >= 0 && box.x + box.width <= viewport.width;
    if (!inView) {
      await locator.scrollIntoViewIfNeeded();
      box = await locator.boundingBox();
    }
    if (!box) throw new Error('The element to click is not visible');
    // A click under the open terminal panel would work and would not be visible: the video shows
    // the panel where the button was, and the reviewer is left with a result and no action.
    if (terminal.isOpen() && isBehindPanel(box, viewport.height, terminal.panelHeight)) {
      throw new Error(
        'The element to click is behind the terminal panel, so the click would not be visible ' +
        'in the recording.\nCall term.close() before operating on the bottom of the page.'
      );
    }
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    // The click does not land dead centre: a human hand lands slightly off centre, and the larger
    // the element the wider the spread — always still inside the element.
    const spread = (size) => (size > 24 ? (human.rng() - 0.5) * Math.min(size * 0.3, 16) : 0);
    const tx = cx + spread(box.width);
    const ty = cy + spread(box.height);
    const dist = await moveTo(tx, ty, Math.min(box.width, box.height));
    await sleep(human.aimDelay(dist));
    await page.mouse.down();
    await sleep(human.wait(pace.clickHoldMs));
    await page.mouse.up();
    await sleep(human.wait(resolvePause(pause, pace, pace.afterClickMs)));
    // After a navigation the fake cursor is redrawn from its default position, so it has to be resynced
    await page.mouse.move(tx + 0.5, ty + 0.5);
  }

  // Click the field, then type. The typing rhythm is uneven: slower at spaces and after punctuation,
  // with the occasional hesitation — Playwright's fixed `delay` gives typewriter-even keystrokes.
  async function type(locator, text) {
    await click(locator, { pause: 'quick' });
    const chars = Array.from(String(text));
    const delays = human.typeDelays(text);
    const keepPace = scheduler();
    for (let i = 0; i < chars.length; i++) {
      await page.keyboard.type(chars[i]);
      await keepPace(delays[i]);
    }
    await sleep(human.wait(pace.afterTypeMs));
  }

  // The <select> dropdown is a widget drawn by the operating system, so it never lands in the video.
  // Do not look for a way to redraw it or force it to render inside the page: every one of those ways
  // has to change the style of the real element, making the layout in the video differ from the layout
  // of the real app — and the evidence loses its value.
  // What is shown here is only the interaction (clicking the field, the value changing) plus a
  // guarantee that the right value gets selected.
  async function select(locator, label) {
    await click(locator, { pause: 'quick' });

    const options = await locator.locator('option').allTextContents();
    const target = options.findIndex((o) => o.trim() === label);
    if (target < 0) throw new Error(`Option not found: ${label}`);

    const current = await locator.evaluate((el) => el.selectedIndex);
    const key = target > current ? 'ArrowDown' : 'ArrowUp';
    for (let i = 0; i < Math.abs(target - current); i++) {
      await page.keyboard.press(key);
      await sleep(human.wait(pace.selectStepMs));
    }

    // In some environments the arrow keys cannot change the selection; settle it through the data,
    // because looking good while selecting the wrong value makes the evidence meaningless
    if ((await locator.evaluate((el) => el.selectedIndex)) !== target) {
      await locator.selectOption({ label });
    }

    // The viewer sees the value in the field change but sees no menu open, because that menu is drawn
    // by the operating system. The caption says so instead of leaving them to work it out.
    const caption = captions.text('selectOption', { value: label });
    const shown = await showNote(caption);
    await sleep(Math.max(human.wait(pace.afterSelectMs), shown ? readingTime(caption, pace) : 0));
    if (shown) await hideCaption();
  }

  // The operating system's file picker cannot be recorded either. Set the file directly, then hold
  // long enough to see the file name appear in the field — that is the part that proves anything.
  async function upload(locator, filePath) {
    await click(locator, { pause: 'quick' });
    await locator.setInputFiles(filePath);
    const caption = captions.text('uploadFile', { file: path.basename(filePath) });
    const shown = await showNote(caption);
    await sleep(Math.max(human.wait(pace.afterUploadMs), shown ? readingTime(caption, pace) : 0));
    if (shown) await hideCaption();
  }

  // boundingBox returns {x, y, width, height}, while the caption drawing works out its placement from
  // the edges (left/top/right/bottom) like a DOMRect. Without those four edges every comparison comes
  // out NaN and the overlay silently drops to the bottom centre of the frame instead of anchoring to
  // the element.
  async function edgesOf(locator) {
    const box = await locator.boundingBox();
    if (!box) return null;
    return {
      left: box.x, top: box.y, right: box.x + box.width, bottom: box.y + box.height,
      width: box.width, height: box.height,
    };
  }

  // A caption in the video. It is narration, so it lands along the bottom of the frame like a
  // subtitle rather than beside any element — there is nothing to anchor to and nothing to cover.
  // Returns false when captions are off, so the caller knows there is nothing to wait around for.
  async function showNote(text) {
    if (!text) return false;
    await page.evaluate((payload) => window.__evCaption?.note(payload), { text });
    notes.push({ at: since(), text });
    return true;
  }

  const hideCaption = () => page.evaluate(() => window.__evCaption?.hide());

  // Captions written by the step script itself, for the places only the step script's author knows
  // need saying: where the data came from, why this state is the correct one, that the OS hid the
  // action that just happened.
  //
  // Also governed by the same switch: once the operator has said "this take has no captions", not one
  // gets through, including the ones the step script calls for directly. One switch, one predictable
  // result.
  async function note(text, { hold } = {}) {
    if (!captions.enabled) return;
    if (!(await showNote(text))) return;
    await sleep(human.wait(hold ?? readingTime(text, pace)));
    await hideCaption();
  }

  // A keyboard action leaves no trace on screen: the mouse sits still, there is no ripple, the viewer
  // just sees the content change with no idea why. So every shortcut press shows the key hint overlay
  // right beside the element being acted on, held long enough to read both the keys and the result.
  async function hotkey(keys, { label, target, pause = pace.afterHotkeyMs, hold = pace.hotkeyHoldMs } = {}) {
    const waitFor = (ms) => sleep(human.wait(ms));
    const caps = keyCaps(keys);

    // With a target, click it first: the viewer sees which element the shortcut is being applied to,
    // and the key hint overlay can anchor to that element instead of dropping to the bottom of the frame.
    let rect = null;
    if (target) {
      await click(target, { pause: 'quick' });
      rect = await edgesOf(target);
    }

    await page.evaluate((payload) => window.__evCaption?.keys(payload), { caps, label, rect });
    await waitFor(pace.beforeHotkeyMs);
    hotkeys.push({ at: (Date.now() - startedAt) / 1000, keys: caps.join(' + '), label });
    await page.keyboard.press(keys);
    await waitFor(hold);
    await hideCaption();
    await waitFor(pause);
  }

  // A dialog the browser puts up itself — alert, confirm, prompt, beforeunload.
  //
  // Two things make this need a helper rather than a plain click. Playwright dismisses a dialog
  // the instant it appears unless something is listening, so by default one never reaches the
  // screen at all. And the click that triggers it does not return until the dialog is answered,
  // so awaiting the click first would wait forever.
  //
  // Nothing may talk to the page while a dialog is up — every evaluate and every mouse move
  // blocks on it — so the cursor and the caption overlays stay still for the duration, which is
  // also what a real dialog looks like.
  async function dialog(body, { accept = true, text, hold = pace.dialogHoldMs, timeout = 10000 } = {}) {
    if (typeof body !== 'function') {
      throw new Error('dialog() takes the steps that trigger it: dialog(async () => { … })');
    }

    let onDialog;
    const appeared = new Promise((resolve, reject) => {
      onDialog = resolve;
      page.once('dialog', resolve);
      setTimeout(() => reject(new Error(
        `No browser dialog appeared within ${timeout}ms.\n` +
        'dialog() is for alert, confirm, prompt and beforeunload. A modal drawn by the ' +
        'application itself is ordinary page content — click it like anything else.'
      )), timeout);
    });

    // Deliberately not awaited: it cannot finish until the dialog below is answered
    const triggered = Promise.resolve().then(body);
    triggered.catch(() => {});   // reported after the dialog is out of the way, not before

    let opened;
    try {
      opened = await appeared;
    } finally {
      page.off('dialog', onDialog);
    }

    const message = opened.message();
    // Held on screen long enough to read, the way a person would before answering
    await sleep(human.wait(hold));
    await (accept ? opened.accept(text) : opened.dismiss());
    await triggered;

    dialogs.push({ at: since(), kind: opened.type(), message, accepted: accept });

    // When the window is being recorded the dialog is in the video and needs no explaining.
    // When only page content is, the viewer sees a value change with nothing to account for it.
    if (!capturesBrowserUi) {
      const caption = captions.text('browserDialog', { accepted: accept, message });
      if (await showNote(caption)) {
        await sleep(readingTime(caption, pace));
        await hideCaption();
      }
    }
    return { message, type: opened.type() };
  }

  let shotIndex = 0;
  async function shot(name) {
    // A screenshot taken while something is being kept out of the video has to be kept out of the
    // screenshot too, or the redaction is theatre: the still sits in the same directory.
    if (active) {
      if (active.mode === 'cut') {
        throw new Error(
          `shot(${JSON.stringify(name)}) is inside a redact(..., { mode: 'cut' }) window.\n` +
          'That stretch is being removed from the video, so a screenshot of it defeats the point.'
        );
      }
      if (!active.locator) {
        throw new Error(
          `shot(${JSON.stringify(name)}) is inside a redact('frame', ...) window.\n` +
          'The whole frame is covered, so the screenshot would be blank. Pass a locator to ' +
          'redact() instead, and the screenshot is masked over that element only.'
        );
      }
    }
    shotIndex += 1;
    const file = path.join(outDir, `${String(shotIndex).padStart(2, '0')}-${name}.png`);
    await page.screenshot({ path: file, mask: active ? [active.locator] : [] });
    return file;
  }

  // Keeping something out of the finished video. What is on screen during `body` is covered, and
  // the step script is the only place that knows when that is — whoever wrote the step knows the
  // key is about to be revealed, so nothing has to be detected afterwards.
  //
  // `area` is the element holding it, or the string 'frame' when the position is not known.
  const REDACT_PADDING = 8;
  const REDACT_MODES = ['blur', 'box', 'cut'];

  async function redact(area, body, { mode = 'blur' } = {}) {
    if (!REDACT_MODES.includes(mode)) {
      throw new Error(
        `Invalid redact mode: ${JSON.stringify(mode)}\nUse one of ${REDACT_MODES.join(' | ')}.`
      );
    }
    if (typeof body !== 'function') {
      throw new Error('redact() takes the area first and the steps to cover second: redact(area, async () => { … })');
    }

    // A removed stretch takes everything in it, so there is no rectangle to measure
    const locator = area === 'frame' || mode === 'cut' ? null : area;
    const measure = async () => {
      if (!locator) return null;
      try {
        return await locator.boundingBox();
      } catch {
        return null;   // not attached yet, or gone already; the other measurement may still land
      }
    };

    const entry = redactions.open({ mode, box: null });
    // Measuring costs a round trip to the browser, so the clock is read after it: the stretch
    // starts where the first covered action does, not where the measurement did.
    let box = await measure();
    const start = since();
    const previous = active;
    active = { locator, mode };

    let failed = false;
    try {
      await body();
    } catch (error) {
      failed = true;
      throw error;
    } finally {
      active = previous;
      box = unionBox(box, await measure());
      if (box) entry.box = padBox(box, REDACT_PADDING, viewport);
      // Leaving `from` unset drops the entry, so a step script that threw halfway does not blur
      // everything after the point it failed.
      if (!failed) {
        if (locator && !box) {
          throw new Error(
            'redact() could not measure the element at either end of the stretch, so there is ' +
            'nothing to cover.\nKeep it on screen for the duration, or pass \'frame\' to cover the ' +
            'whole frame instead.'
          );
        }
        entry.from = start;
        entry.to = since();
      }
    }
  }

  return {
    page, mark, click, type, select, upload, hotkey, note, shot, redact, dialog, sleep, moveTo,
    term: terminal.term,
  };
}

// The commands are the half of the evidence the video is worst at: a viewer scrubbing for the
// moment a job was picked up has to watch the panel until they spot it. The waitFor rows matter
// most of all — that is the assertion the take rests on, stated once, with the text that matched.
function buildCommandSection(commands, trimAt, removed = []) {
  const shown = placed(commands, trimAt, removed);
  if (!shown.length) return '';
  const rows = shown.map((entry) => {
    const at = fmt(entry.at);
    if (entry.kind === 'wait') return `- ${at}  waited for ${entry.text} — matched \`${entry.matched}\``;
    const suffix = entry.kind === 'run' ? `exit ${entry.exitCode}`
      : entry.kind === 'start' ? 'started, left running'
      : 'interrupted';
    return `- ${at}  \`${entry.text}\` — ${suffix}`;
  });
  return `## Commands run in the terminal\n\n${rows.join('\n')}\n\n`;
}

// Where a moment of the take lands in the finished video. The encode seeks past the page-load
// wait, and a redaction in `cut` mode removes stretches after that, so every section of the
// runbook has to ask the same question the same way — a timestamp that is stale by the length of
// one removed stretch still looks like a timestamp.
//
// Returns null for a moment that was removed: the row is dropped rather than left pointing at a
// second where the viewer will find something else.
const placeAt = (at, trimAt, removed) => shiftTime(Math.max(0, at - trimAt), removed);

function placed(entries, trimAt, removed) {
  return entries
    .map((entry) => ({ ...entry, at: placeAt(entry.at, trimAt, removed) }))
    .filter((entry) => entry.at !== null);
}

// The timeline is not written out as its own file: it lives in the runbook so there is only one place to edit.
function buildTimeline(marks, trimAt, duration, removed = []) {
  const shifted = placed(marks, trimAt, removed);
  const rows = shifted
    .map((m, i) => ({ from: m.at, to: shifted[i + 1]?.at ?? duration, label: m.label }))
    .filter((r) => r.to - r.from > 0.4);
  return rows.map((r) => `${fmt(r.from)} - ${fmt(r.to)}  ${r.label}`).join('\n');
}

// What the browser asked and what was answered. Worth its own section whichever backend
// recorded the take: in a page recording the dialog is not in the video at all, and in a window
// recording it is on screen for a couple of seconds among everything else.
function buildDialogSection(dialogs, trimAt, removed) {
  const shown = placed(dialogs, trimAt, removed);
  if (!shown.length) return '';
  const rows = shown.map((entry) => (
    `- ${fmt(entry.at)}  ${entry.kind}: "${entry.message}" — ${entry.accepted ? 'accepted' : 'dismissed'}`
  ));
  return `## Dialogs the browser put up\n\n${rows.join('\n')}\n\n`;
}

// A blurred rectangle in the middle of a video looks like a rendering fault unless the reader is
// told it was deliberate. Listing where and when also lets whoever checks the evidence confirm the
// right thing was covered — the position of a secret is not the secret.
function buildRedactionSection(redactions, trimAt, removed) {
  const covers = placed(
    redactions.filter((r) => r.mode !== 'cut').map((r) => ({ ...r, at: r.from })),
    trimAt, removed,
  );
  if (!covers.length) return '';
  const rows = covers.map((entry) => {
    const until = placeAt(entry.to, trimAt, removed) ?? entry.at;
    const how = entry.mode === 'box' ? 'covered with a solid block' : 'blurred';
    const where = entry.box
      ? `${entry.box.width}x${entry.box.height} at ${entry.box.x},${entry.box.y}`
      : 'the whole frame';
    return `- ${fmt(entry.at)} - ${fmt(until)}  ${how} (${where})`;
  });
  return `## Kept out of the video\n\n${rows.join('\n')}\n\n`;
}

// A reader comparing the runbook against the video has to know the video is shorter than what was
// recorded, or a gap in the action reads as a bug in the app.
function buildRemovedSection(removed) {
  if (!removed.length) return '';
  const total = removed.reduce((sum, r) => sum + (r.to - r.from), 0);
  return `## Removed from the video\n\n`
    + `${removed.length} ${removed.length === 1 ? 'stretch' : 'stretches'} `
    + `totalling ${total.toFixed(1)}s were cut out of this take, because what was on screen for `
    + `them does not belong in evidence. Every timestamp above is on the shortened video.\n\n`;
}

// A shortcut is the one action a viewer can miss even though the key hint overlay shows for over a
// second, so list them with timestamps to scrub back to the right spot. No shortcuts, no section.
function buildHotkeySection(hotkeys, trimAt, removed = []) {
  const shown = placed(hotkeys, trimAt, removed);
  if (!shown.length) return '';
  const rows = shown.map((h) => {
    const at = fmt(h.at);
    return `- ${at}  \`${h.keys}\`${h.label ? ` — ${h.label}` : ''}`;
  });
  return `## Keyboard shortcuts in the video\n\n${rows.join('\n')}\n\n`;
}

// Captions are recorded here as well because most of them talk about things the recording does NOT
// contain (the <select> dropdown, the file picker). A runbook reader needs that list without replaying the video.
function buildNoteSection(notes, trimAt, removed = []) {
  const shown = placed(notes, trimAt, removed);
  if (!shown.length) return '';
  const rows = shown.map((n) => `- ${fmt(n.at)}  ${n.text}`);
  return `## Captions shown in the video\n\n${rows.join('\n')}\n\n`;
}

function encodeMp4(outDir, name, webm, trimAt, video, filter) {
  const mp4 = path.join(outDir, `${name}.mp4`);
  execFileSync('ffmpeg', [
    '-y', '-v', 'error', '-ss', String(trimAt), '-i', webm,
    // The redaction graph runs before the encoder, so what is covered never reaches the h264
    // stream at all — there is no earlier version of the frame left inside the file.
    ...(filter ? ['-filter_complex', filter.graph, '-map', `[${filter.label}]`] : []),
    '-c:v', 'libx264', '-preset', video.preset, '-crf', String(video.crf),
    '-pix_fmt', 'yuv420p', '-movflags', '+faststart', mp4,
  ]);
  fs.unlinkSync(webm);
  return mp4;
}

// The output of a recording is a heavy file that can be regenerated; it does not belong to the repo's
// history. Where it is stored has to be an ALREADY-ignored area — not merely untracked: `git add -A`
// swallows untracked files whole, and once a video lands in a commit only rewriting history gets it out.
//
// The skill does not edit the project's .gitignore itself (that would be editing someone else's repo for
// an ancillary task), but it hands over the line to add so the user only has to paste it.
function gitTop() {
  try {
    return execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
}

function isTracked(dir) {
  try {
    const out = execFileSync('git', ['ls-files', '--', dir], { encoding: 'utf8' });
    return out.trim().length > 0;
  } catch {
    return false;
  }
}

function ignoreHints(outDir, top) {
  const rel = path.relative(top, path.resolve(outDir)).split(path.sep).join('/');
  const hints = [`${rel}/`];
  // When the evidence directory sits inside each issue's own directory, one pattern line is tidier than adding every issue
  const parts = rel.split('/');
  const idx = parts.lastIndexOf('evidence');
  if (idx > 0) hints.push(`${parts[0]}/**/evidence/`);
  return hints;
}

function assertIgnoredByGit(outDir) {
  if (process.env.EVIDENCE_ALLOW_TRACKED === '1') return;
  const top = gitTop();
  if (!top) return; // not a git repo: not the skill's business

  try {
    execFileSync('git', ['check-ignore', '-q', outDir], { stdio: 'ignore' });
    return; // already ignored
  } catch (e) {
    if (e.status !== 1) return; // git failed for some other reason: skip
  }

  const tracked = isTracked(outDir);
  const state = tracked
    ? 'is tracked by git — the recording will go straight into the next commit'
    : 'is not ignored — `git add -A` will swallow the video and the images into a commit';

  throw new Error(
    `OUT_DIR ${state}:\n  ${path.resolve(outDir)}\n\n` +
    'Ask the user to add one of the following lines to .gitignore, then run again:\n' +
    ignoreHints(outDir, top).map((h) => `  ${h}`).join('\n') + '\n\n' +
    'The skill does not edit .gitignore itself. If the user has weighed it up and still wants to write ' +
    'here, set EVIDENCE_ALLOW_TRACKED=1.'
  );
}

// A take is evidence already attached to an MR; overwriting it loses the very thing to compare against
// when there is a dispute. By default the previous results are moved into evidence/v1, v2… before the
// new take is recorded into the root directory.
// Step scripts, fixtures and configuration are not results, so they stay where they are.
function runArtifacts(outDir, name) {
  return fs.readdirSync(outDir).filter((f) => (
    /^\d{2}-.*\.png$/.test(f)
    || f === '99-full-page.png'
    // .webm and .raw.mp4 are what a backend captures before the encode reads it and deletes it.
    // They are only ever left behind by a run that died partway, and they are large.
    || [
      `${name}.mp4`, `${name}.webm`, `${name}.raw.mp4`,
      `${name}-runbook.md`, `${name}-console.log`,
    ].includes(f)
  ));
}

function archivePreviousRun(outDir, name, overwrite) {
  const existing = runArtifacts(outDir, name);
  if (!existing.length) return null;

  if (overwrite) {
    existing.forEach((f) => fs.unlinkSync(path.join(outDir, f)));
    return null;
  }

  const used = fs.readdirSync(outDir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && /^v\d+$/.test(e.name))
    .map((e) => Number(e.name.slice(1)));
  const version = (used.length ? Math.max(...used) : 0) + 1;

  const dir = path.join(outDir, `v${version}`);
  fs.mkdirSync(dir, { recursive: true });
  existing.forEach((f) => fs.renameSync(path.join(outDir, f), path.join(dir, f)));
  console.log(`ARCHIVED: previous take moved into ${dir}`);
  return dir;
}

// A relative path is only easier to read when it really is shorter; when the results sit outside the
// current directory and printing one gives a string of ../../.., the absolute path is clearer.
function displayPath(target) {
  const abs = path.resolve(target);
  const rel = path.relative(process.cwd(), abs);
  return rel && !rel.startsWith('..') ? rel : abs;
}

const humanSize = (bytes) => (bytes >= 1024 * 1024
  ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
  : `${Math.round(bytes / 1024)} KB`);

function dirSize(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).reduce((sum, entry) => {
    const full = path.join(dir, entry.name);
    return sum + (entry.isDirectory() ? dirSize(full) : fs.statSync(full).size);
  }, 0);
}

// The user needs to know exactly which files were just produced so they can open them and attach them
// to the MR. Keeping the old takes around is deliberate, but keeping them forever bloats the directory —
// so say up front how much space they take and how to drop them, instead of leaving the user to find
// out months later.
function reportResult(outDir, name, mp4, runbook, shots, durationSeconds) {
  const rel = displayPath;
  console.log('');
  console.log(`VIDEO:   ${rel(mp4)}  (${durationSeconds.toFixed(1)}s, ${humanSize(fs.statSync(mp4).size)})`);
  console.log(`RUNBOOK: ${rel(runbook)}`);
  console.log(`SHOTS:   ${shots.length} in ${rel(outDir)}`);

  const olds = fs.readdirSync(outDir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && /^v\d+$/.test(e.name))
    .map((e) => e.name)
    .sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)));

  if (!olds.length) return;

  const sizes = olds.map((v) => `${v} (${humanSize(dirSize(path.join(outDir, v)))})`);
  console.log('');
  console.log(`PREVIOUS: ${sizes.join(', ')}`);
  console.log(`  Once there is nothing left to compare against, delete them: rm -rf ${olds.map((v) => rel(path.join(outDir, v))).join(' ')}`);
}

// A description for re-running later without having to work the screen out from scratch again.
function writeRunbook(outDir, name, meta) {
  const file = path.join(outDir, `${name}-runbook.md`);
  const rel = displayPath;
  const body = `---
name: ${name}
app: ${meta.app}
base_url: ${meta.baseUrl}
start_path: ${meta.start}
captions: ${meta.captions}
capture: ${meta.capture}${meta.captureFrame ? `
capture_frame: ${meta.captureFrame.width}x${meta.captureFrame.height} at ${meta.captureFrame.x},${meta.captureFrame.y}, ${meta.captureFrame.scale}x` : ''}
config: ${meta.configFile ? rel(meta.configFile) : `(none — recorded with BASE_URL=${meta.baseUrl})`}
steps: ${rel(meta.stepsFile)}
video: ${rel(meta.video)}
duration_seconds: ${meta.duration.toFixed(1)}
recorded_at: ${meta.recordedAt}
---

# Runbook — ${name}

## Re-run

\`\`\`bash
OUT_DIR=${rel(outDir)} node ${rel(meta.runner)} ${rel(meta.stepsFile)}
\`\`\`

The step script, the configuration and the account are all fixed, so the command above reproduces exactly this take.
To change what gets recorded, edit \`${rel(meta.stepsFile)}\`, not the runbook file.

## Steps in the video

${meta.timeline}

${meta.hotkeySection}${meta.noteSection}${meta.commandSection}${meta.dialogSection}${meta.redactionSection}${meta.removedSection}## Screenshots

${meta.shots.length ? meta.shots.map((f) => `- ${f}`).join('\n') : '- (none)'}

## Environment

${meta.fixes.length ? meta.fixes.map((f) => `- fixed automatically: ${f}`).join('\n') : '- nothing needed fixing'}

## Page errors recorded during the take

${meta.problems.length ? meta.problems.slice(0, 20).map((p) => `- ${p}`).join('\n') : '- none'}
`;
  fs.writeFileSync(file, body);
  return file;
}

// The account is stored so a recording does not have to ask for it again, which means the runner
// holds a password while a step script runs commands that may echo one. Whatever the project's
// login adapter chose to call it, these are the fields worth blacking out of the panel, the
// runbook and the screenshots.
const SECRET_FIELD = /pass|secret|token|key/i;

function accountSecrets(account) {
  if (!account || typeof account !== 'object') return [];
  return Object.entries(account)
    .filter(([field, value]) => typeof value === 'string' && SECRET_FIELD.test(field))
    .map(([, value]) => value);
}

// ---------- run ----------
async function main() {
  const stepsPath = process.argv[2];
  if (['--help', '-h'].includes(stepsPath) || !stepsPath) {
    help();
    process.exit(stepsPath ? 0 : 1);
  }
  const steps = require(path.resolve(stepsPath));

  const stepsFile = path.resolve(stepsPath);
  const { file: configFile, config } = loadProjectConfig(path.dirname(stepsFile));
  const settings = resolveSettings(config);
  const { pace, viewport, video: videoOpts } = settings.recording;
  const { name: app, appConfig, baseUrl } = resolveApp(config, steps.app);

  const outDir = process.env.OUT_DIR;
  if (!outDir) throw new Error('OUT_DIR must be provided');
  assertOutsideSkill(outDir, 'OUT_DIR');
  assertOutsideSkill(stepsFile, 'Step script');
  assertIgnoredByGit(outDir);
  const name = process.env.VIDEO_NAME || steps.name || 'evidence';
  fs.mkdirSync(outDir, { recursive: true });

  archivePreviousRun(outDir, name, settings.output.overwrite);

  const fixes = await prepareApp({ appConfig, name: app, baseUrl });
  const browser = await launchBrowser(settings);

  // Sign in in a separate context, not recorded: the viewer does not need to see this step and
  // the video must not leak the sign-in credentials
  const storageState = await signIn({ browser, appConfig, name: app, baseUrl, settings });

  const capture = createCapture({
    mode: settings.recording.capture,
    outDir,
    name,
    settings: settings.recording,
    viewport,
  });

  const context = await browser.newContext({
    viewport,
    locale: settings.recording.locale,
    deviceScaleFactor: 1,
    storageState,
    // An app with a strict Content-Security-Policy would block the cursor's styles; the cursor is only
    // an overlay serving the recording, not the thing being verified, so bypass CSP here.
    bypassCSP: true,
    ...capture.contextOptions(),
  });
  await context.addInitScript({ path: path.join(__dirname, 'cursor.js') });
  await context.addInitScript({ path: path.join(__dirname, 'caption.js') });
  await context.addInitScript({ path: path.join(__dirname, 'terminal-panel.js') });
  const page = await context.newPage();
  capture.attach({ context, page });
  const problems = watchProblems(page);

  const marks = [];
  const hotkeys = [];
  const notes = [];
  const dialogs = [];
  const redactions = createRedactions();
  const captions = createCaptions(settings.recording.captions);

  // The seed comes from the step script's name: the pacing jitter of a given step script is the same
  // across every take, so the runbook keeps its promise that re-running produces this same recording.
  const human = createHuman({ pace, viewport, seed: name });

  await page.goto(`${baseUrl}${steps.start || '/'}`, { waitUntil: 'networkidle' });
  await sleep(pace.settleMs);

  // Park the cursor somewhere off centre before the video starts. Without this the first frame has the
  // cursor sitting dead centre and the first movement starts from there — nobody leaves their mouse in
  // the middle of the screen.
  const resting = human.restingPoint();
  await page.mouse.move(resting.x, resting.y);
  page.__cursor = resting;

  // The backend decides both: Playwright has been recording since the page existed, so the load
  // has to be trimmed off the front; a screen capture is started once the page is ready and has
  // nothing in front to remove.
  const { startedAt, trimAt } = await capture.start();

  const terminal = createTerminal({
    page,
    viewport,
    config: settings.recording.terminal,
    human,
    pace,
    root: ROOT,
    since: () => (Date.now() - startedAt) / 1000,
    secrets: accountSecrets(makeAccountStore(settings.output.accountStore).get(app)),
  });

  const ctx = buildContext({
    page, outDir, marks, hotkeys, notes, dialogs, startedAt, pace, viewport, human, captions,
    terminal, redactions,
    // A dialog the browser draws is in the video when the window is being recorded, and needs a
    // caption standing in for it when only page content is.
    capturesBrowserUi: capture.mode !== 'page',
  });
  ctx.baseUrl = baseUrl;
  try {
    await steps.run(ctx);
  } finally {
    // A step script that throws halfway must not leave a shell — or whatever it was running —
    // alive on the machine after the runner has gone.
    await terminal.dispose();
  }

  await sleep(pace.tailMs);
  const total = (Date.now() - startedAt) / 1000;
  const { file: recorded } = await capture.stop();

  // The fullPage screenshot has to be taken outside the recording context, because the scrolling would land in the video
  if (steps.fullPageShot !== false) {
    const shotContext = await browser.newContext({ viewport, locale: settings.recording.locale, storageState });
    const shotPage = await shotContext.newPage();
    await shotPage.goto(`${baseUrl}${steps.fullPageShot || steps.start || '/'}`, { waitUntil: 'networkidle' });
    await shotPage.screenshot({ path: path.join(outDir, '99-full-page.png'), fullPage: true });
    await shotContext.close();
  }
  await browser.close();

  const filter = buildFilter(redactions.all(), trimAt);
  const removed = filter?.removed ?? [];
  const cutSeconds = removed.reduce((sum, r) => sum + (r.to - r.from), 0);
  const duration = total - trimAt - cutSeconds;

  const mp4 = encodeMp4(outDir, name, recorded, trimAt, videoOpts, filter);
  const timeline = buildTimeline(marks, trimAt, duration, removed);

  // Only write the log file when there really are errors, so the evidence directory stays free of clutter
  let problemFile = null;
  if (problems.length) {
    problemFile = path.join(outDir, `${name}-console.log`);
    fs.writeFileSync(problemFile, `${problems.join('\n')}\n`);
  }

  const shots = fs.readdirSync(outDir).filter((f) => f.endsWith('.png')).sort();
  const runbook = writeRunbook(outDir, name, {
    app, baseUrl, start: steps.start || '/', configFile, stepsFile, video: mp4,
    captions: captions.enabled ? captions.locale : 'off',
    capture: capture.mode,
    // What was recorded and at how many pixels to the point. A window capture can be wrong in a
    // way that looks right — a crop of part of the window fills the frame just as well as the
    // whole of it — so the numbers it used are written down where they can be measured against
    // the video itself.
    captureFrame: capture.frame(),
    duration, recordedAt: new Date().toISOString(),
    runner: __filename, timeline, hotkeySection: buildHotkeySection(hotkeys, trimAt, removed),
    noteSection: buildNoteSection(notes, trimAt, removed),
    commandSection: buildCommandSection(terminal.commands, trimAt, removed),
    dialogSection: buildDialogSection(dialogs, trimAt, removed),
    redactionSection: buildRedactionSection(redactions.all(), trimAt, removed),
    removedSection: buildRemovedSection(removed),
    shots, fixes, problems,
  });

  if (settings.recording.devtools) {
    console.log(
      'NOTE: DevTools was open, and it takes its room out of the page area while the page still '
      + `renders at ${viewport.width}px wide. The right-hand side of the application is cut off in `
      + 'this take. Lower recording.viewport.width if that side matters.'
    );
  }
  fixes.forEach((f) => console.log(`FIXED: ${f}`));
  console.log(timeline);
  if (problemFile) {
    console.log('');
    console.log(`PROBLEMS: ${problems.length} page errors — see ${path.relative(process.cwd(), problemFile)}`);
  }
  reportResult(outDir, name, mp4, runbook, shots, duration);
}

// Only self-runs when invoked directly; a require pulls in just the functions (used by the tests)
if (require.main === module) {
  main().catch((e) => {
    console.error(String((e && e.message) || e));
    process.exit(1);
  });
}

// buildContext is exposed so the real pacing of the actions (how long each helper takes) can be measured
// without recording a whole video; everything else is a black box.
module.exports = {
  main, buildContext, archivePreviousRun, reportResult, runArtifacts,
  // Exported for the unit tests: pure helpers that decide timings, timeline rows and the
  // .gitignore hints, none of which need a browser to be checked.
  fmt, keyCaps, readingTime, buildTimeline, buildHotkeySection, buildNoteSection,
  buildCommandSection, buildDialogSection, buildRedactionSection, buildRemovedSection, placeAt,
  ignoreHints,
  // Re-exported where the pacing tests already look for it; it lives in human.js with the rest
  // of the pacing, because the terminal helpers read the same vocabulary.
  resolvePause,
};
