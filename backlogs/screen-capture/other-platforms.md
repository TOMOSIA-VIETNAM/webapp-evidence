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
