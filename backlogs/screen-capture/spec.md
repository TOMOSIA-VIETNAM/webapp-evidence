# Recording the screen, and keeping out of the video what should not be in it

Follows the terminal panel (`backlogs/terminal-panel/spec.md`), which put a real shell inside the
page. This covers what is still outside it.

## The gap

The runner records page content through Playwright. Everything the operating system draws is
missing: the `<select>` dropdown, the file picker, `confirm`/`alert`, the print dialog. So is
anything Chrome draws around the page — the address bar, the download bar — and a popup window
opens as a second recording nobody asked for.

The terminal panel closed the "what happened on the machine" half of this. It cannot close the
"what the operating system drew" half, because that is not in any page.

## Two backends, one step script

The step script does not change. A setting decides what the frame is:

| `recording.capture` | What is recorded | Needs |
|---|---|---|
| `page` (default) | page content, through Playwright | nothing; runs headless, runs in CI |
| `window` | the Chrome window, through ffmpeg | a visible screen, macOS Screen Recording permission, an operator not touching the machine |
| `screen` | the whole display | the same, plus everything else on that display is in the video |

`window` is the one worth having. On macOS the things a page recording misses are drawn **inside
the browser window**: the file picker is a sheet, `confirm`/`alert` is tab-modal, the print dialog
is a sheet, and a `<select>` opens against its element. Cropping to the window catches all of them
and cannot catch Slack.

`screen` exists for what escapes the window and is not the default. The runner says what it is
about to include.

### Where the crop comes from

The window is placed at a known position (`--window-position=0,0`) and the page reports the rest:

```js
await page.evaluate(() => ({
  x: window.screenX, y: window.screenY,
  width: window.outerWidth, height: window.outerHeight,
  scale: window.devicePixelRatio,
}));
```

avfoundation captures physical pixels, so the crop is the logical rect times `devicePixelRatio` —
on a Retina display, getting that wrong crops a quarter of the window and nobody notices until the
video is watched.

### Where t=0 comes from

`page` gets its trim point from the runner's own clock. ffmpeg does not start when it is spawned:
it opens the device, negotiates a format, and only then writes a frame. Guessing that delay puts
every timeline row and every caption out by a few hundred milliseconds.

So the capture reports it. ffmpeg runs with `-progress pipe:1 -nostats`, and the first `frame=`
line it prints is the instant the recording actually began. The take starts from there.

Stopping asks first and escalates: `q` on ffmpeg's stdin, then an interrupt, then a kill, each
after a couple of seconds. avfoundation answers none of the first two — the capture device holds
ffmpeg somewhere neither reaches — so on macOS every take ends at the last one, and the file has
to survive that. It does, because it is written in fragments that are flushed as they are made:
an ordinary mp4 keeps its index in memory until the process exits cleanly, and a killed one has
none at all.

### Permission

Without Screen Recording permission macOS does not fail — it hands back a picture of the desktop
wallpaper, and the take looks like it worked until someone watches it.

Before the take the runner captures a single frame, which settles what it can: whether the device
hands over anything at all, and at what size. Missing permission is not among the things it can
settle, because a wallpaper is a picture like any other — it is not flat, and nothing about it
distinguishes it from an application that happens to be showing one. What catches that is the
end-to-end check measuring the content of the frame against what the page should be showing, and
that is a check run by hand on a machine with a screen, not a gate inside the runner.

## Consent

Recording the screen records whatever is on it. That needs the operator's agreement, and the
agreement has to be given before the capture starts, not discovered afterwards.

The runner will not start a `window` or `screen` capture without `SCREEN_CAPTURE=1` in its
environment. It refuses rather than prompting, because the runner is started by an agent through a
shell: a prompt on stdin would hang forever. The agent asks the user first — it is the one with a
channel to them — and passes the flag once they agree.

Then, on the machine itself:

- A notice appears on screen — an `osascript` dialog, which floats above every application —
  before the question is asked. `announce.js` is a command of its own for exactly that reason:
  the person about to have their screen recorded is not necessarily looking at the terminal. It
  says nothing is being recorded yet, asks for Do Not Disturb, and sends them back to the
  terminal where the question is.
- It waits to be pressed. A notice that dismisses itself is one they may never see, and this is
  the one thing they have to have seen. Nobody pressing it within five minutes is nobody at the
  machine, and nothing is recorded.
- Do Not Disturb is asked for, not set. macOS offers no dependable way to turn it on and put it
  back, and a take that silently left it on afterwards would be worse than one that asked.
- A countdown follows their answer in the terminal, so there is time to take a hand off the
  keyboard. There is no second notice: the answer is the handover.

## Redaction

Two different problems, and only one of them can be solved by marking things in advance.

### What the step script knows about

An API key on screen, a customer's name, a token in a response. Whoever wrote the step knows
exactly when it appears, so they say so, and it costs nothing to detect:

```js
await redact(page.locator('#api-key'), async () => {
  await click(page.getByRole('button', { name: 'Reveal' }), { pause: 'observe' });
  await shot('key-revealed');          // masked in the screenshot too
});
```

`redact('frame', …)` covers the whole frame for the case where the position is not known.

| mode | What it does | When |
|---|---|---|
| `blur` (default) | blurs the region for that stretch of the video | something is there and its shape still tells the story |
| `box` | fills it with a solid block | the value must be unreadable, not merely hard to read |
| `cut` | removes the stretch from the video | it should never have been recorded at all |

`blur` and `box` leave the timeline alone. **`cut` moves every timestamp after it**, so the runbook
has to be rebuilt against the shortened video: a runbook pointing at 02:14 for something now at
01:58 is wrong in a way nobody checks. Marks falling inside a cut are dropped rather than collapsed
to a zero-length row.

The region comes from the locator's box, measured on entering and again on leaving, and the union
of the two is used — an element that moves during the stretch would otherwise be blurred where it
used to be. Measured nowhere, it is an error naming `'frame'` as the alternative, not a silent
fallback to no redaction.

Screenshots taken inside a region window are masked by Playwright itself. Inside a `'frame'` window
`shot()` is refused: a screenshot that is entirely blacked out proves nothing and looks like a bug.

### What nobody predicted

Only `window` and `screen` have this problem, and only `screen` has much of it. It cannot be solved
by marking, because the step script does not know a colleague is about to call.

The order is prevention, then review by a person:

1. The crop keeps everything outside the browser window out of the frame.
2. Do Not Disturb keeps banners out of what is left — asked for in the notice, not set by the
   runner.
3. After the take, the recording is reviewed once with the `vision` skill, and what it finds is
   **reported to the user with timestamps**, not redacted automatically.

Point 3 is deliberately not a detector wired to an eraser. A model reading contact sheets can miss
a frame, and a missed frame is a video already sent. It is worth having as a last look precisely
because it is cheap — one pass — and because a person decides what happens next.

## Configuration

```js
recording: {
  capture: 'page',            // 'page' | 'window' | 'screen'
  screenCapture: {
    framerate: 30,
    display: 0,               // which display, when there is more than one
    countdownSeconds: 3,      // between the answer in the terminal and the first frame
    maxSeconds: 600,          // a ceiling, so a runner that dies leaves no recorder running
  },
}
```

## Tests

Unit, no browser and no screen:

- the crop rectangle: logical rect times scale, on a 1x and a 2x display, and a window that is not
  at the origin
- the ffmpeg filter chain each redaction mode builds, including two overlapping regions
- the timestamp mapping `cut` produces, and that a mark inside a cut is dropped
- the ffmpeg progress parser that decides t=0, including a partial line split across two reads
- refusing to start without consent, and refusing `shot()` inside a `'frame'` window

End to end, on this machine: a `window` capture of the demo app whose frame contains the browser's
own chrome — something no `page` take can contain — and a redacted stretch that is measurably
blurred where the unredacted take is sharp.
