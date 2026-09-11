# Recording a screen on Linux and Windows

The page backend works anywhere Chrome and Node do, and it is the default. The window and screen
backends are macOS only, and refuse by name elsewhere rather than trying: each operating system
numbers its capture devices, reports its pixels and answers a stop request differently, and a
backend that half works produces a video that looks recorded and is wrong.

Only macOS is implemented because only macOS could be tested here. What follows is what the work
is, not a claim that it would work.

## What is already shared

Everything except the ffmpeg input arguments:

- the display's size and usable area, from a browser context with no viewport — Chrome reports
  the real display there, on any platform
- the scale, from the ratio between the frame the device hands over and the display's own size
- the crop arithmetic, the fit check, the bounded stop, the readability check, the redaction
  graph, the consent gate

## Linux

```
-f x11grab -framerate <fps> -video_size <w>x<h> -i <display>+<x>,<y>
```

The crop is part of the input rather than a filter, so `cropFor` feeds `-video_size` and the
`+x,y` suffix instead of `-vf crop`. `DISPLAY` names the screen; there is no device list to
parse. Wayland does not answer to x11grab at all — `-f kmsgrab` needs `CAP_SYS_ADMIN`, and
`pipewire` needs a portal — so a Wayland session is its own decision, probably another refusal.

Unknown, and the reason this is not written blind: whether `q` stops x11grab (it almost
certainly does, which would make the escalation's first step the usual one rather than the last)
and whether its timestamps need the same constant-rate resampling avfoundation does.

## Windows

```
-f gdigrab -framerate <fps> -offset_x <x> -offset_y <y> -video_size <w>x<h> -i desktop
```

Same shape: the crop is part of the input. gdigrab does not see hardware-accelerated or
protected surfaces, which for a browser window is worth checking before trusting a take.

The terminal panel is refused on Windows separately, for a different reason: it drives a POSIX
shell through pipes and stops long-running commands by signalling a process group. Under WSL
both are available and both backends would be the Linux ones.

## What to do first

Add the input arguments per platform behind the existing interface, then run
`tests/e2e/run-window.sh` on that machine. It measures the video against the rectangle the
runner recorded, which is the assertion that catches a wrong scale — the fault that passed every
earlier version of the check on macOS.

# Recording one display out of several

`recording.screenCapture.display` picks which display avfoundation captures, and
`parseScreenDevices` maps a display number to the device index it happens to have today. That
much works. What does not is everything that assumes there is only one:

- The window is launched at `--window-position=0,0`, which is the primary display. There is no
  way to ask for it on another one.
- `window.screenX` and `screenY` are global coordinates spanning every display, while the crop
  is measured against the captured display's own origin. A window on a secondary display would
  be cropped at an offset the size of the primary.
- `displayMetrics` reports the display the browser is on. Recording a different one leaves the
  runbook's `capture_frame` describing the wrong screen, and a redaction rectangle placed
  against it.

So today a screen recording is correct only for the display the browser window is on, and the
browser window is always on the primary.

## Why it is worth finishing

It is the strongest answer there is to the question this whole feature keeps running into:
what else on that screen ends up in the video. A second display recorded on its own has nothing
else on it — the operator keeps working on the first one, and the evidence cannot pick up their
mail. It is what the browser extensions that do this offer, and it is the reason people reach
for them.

## What it needs

The display's origin, so a global window position can be turned into a position on the captured
display, and a way to place the window there. `window.screen.availLeft` and `availTop` give the
origin of the display the window is already on, which is enough to check the two agree and
refuse when they do not; moving the window to a chosen display needs more than Chrome's launch
arguments offer, so it may have to be the operator who drags it and confirms.

## A clean desktop, for people with one display

macOS Spaces and Windows virtual desktops both give an empty desktop to record against, and
neither can be created reliably from a script: macOS has no public API for Spaces, and Windows'
is undocumented. Asking is the honest way — the notice shown before a recording is where that
belongs.

It matters less than it sounds. A window capture crops to the browser window, so what is behind
it is already out of frame whichever desktop it is on; the notice's advice about Do Not Disturb
covers the one thing that can still arrive on top. A clean desktop is worth asking for only for
a `screen` capture, which is the backend that records everything.

# Chrome's other window modes, and why none of them is adopted

Asked whether a screen recording should put the browser in full screen, in `--app` mode, or in
`--kiosk`. Measured against what they would each buy, none earns its place, and the reasoning is
here so it does not have to be had again.

| Mode | What it gives | What it costs |
|---|---|---|
| `--start-fullscreen` | on macOS a Space of its own, no Dock, no menu bar | the toolbar auto-hides, so the URL is not in the video |
| `--app=<url>` | a window with no tab strip and no address bar | the same loss, deliberately |
| `--kiosk` | full screen, no browser UI, some shortcuts blocked | the same loss, and it blocks nothing the operator's keyboard can still do |

The reason all three fall down is the same. They are being considered to keep other things out
of the frame, and a window capture already does that by construction: it crops to the browser
window, so the desktop behind it is out whatever mode the window is in. What the three actually
change is how much of the browser is in the frame, and the answer they all give is "less" —
starting with the address bar, which is often the part that proves which environment was
recorded.

Full screen looks like the exception, because `screen` records everything and full screen leaves
nothing else to record. But `screen` exists for what escapes the browser window, and full screen
makes the window the whole display, so `window` would have covered it. The two cancel out.

Where one of these would genuinely earn its place is a different request: evidence that has to
show the application with no browser around it at all — a kiosk build, a presentation, a
screenshot for a design review. That is `--app`, it is worth a `recording.chromeless` setting
when someone asks for it, and it should be announced before a take so nobody is surprised by a
video with no address bar in it.

None of it blocks the one thing that really can spoil a take: the operator typing. Nothing short
of an OS-level input block does, and there is no dependable one to reach for.

# Recording a window that the application opened

A popup, a `target="_blank"`, an OAuth window. The page backend records each page separately, so
a second window becomes a second video nobody asked for; the window backend crops to the window
it measured at the start, so a new one opens outside the frame.

Neither is right, and the fix differs by backend: the page backend would have to record every
page in the context and say which is which, and the window backend would have to follow the
frontmost window or widen the crop to hold both. Worth deciding once, with a take that opens one
to check against — including on Windows, where the whole capture backend is unimplemented and
this would be part of proving it.

# The translate bubble, which is not solved

On a page in a language the browser is not set to, Chrome raises its own offer to translate over
the page. A window capture records it, and it is not part of the application being recorded. It
turned up in a real take.

## What has been measured

- `--disable-features=Translate,TranslateUI` does NOT stop it. The switch was confirmed present
  on Chrome's own command line via `chrome://version`, and the bubble was still on screen in the
  recording.
- Passing that switch at all is harmful for a second reason: Chrome takes the last value for a
  repeated switch, so it replaces the list Playwright relies on rather than adding to it.

## What has not been measured, and how to

Giving the browser the page's own language — `recording.locale`, which Playwright applies to the
context as `Accept-Language` and `navigator.language`. The reasoning is that Chrome offers a
translation when the page's detected language is not among the browser's, so a match should
produce no offer. That is reasoning, not a result.

Measuring it needs a window capture, because the bubble is browser UI and no page screenshot can
hold it: record the same page twice with `capture: 'window'`, once with `recording.locale` set to
the page's language and once not, and read a frame of each. Two things that wasted a probe here:
`chrome://translate-internals` gave no usable event rows, and a `file://` page may not be offered
a translation at all — serve it over http.

If the locale does settle it, the remedy belongs in the runner rather than in advice: a step
script author cannot be relied on to remember the language of every page a take visits.
