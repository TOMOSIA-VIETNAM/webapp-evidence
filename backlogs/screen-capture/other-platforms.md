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
