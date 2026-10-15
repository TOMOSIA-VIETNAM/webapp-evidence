# Handing the machine over, take after take

A screen take takes the machine over: the browser comes to the front, other applications are
hidden, the pointer is parked. Between two takes — a step failed, the agent is rewriting the
script — nothing is recorded and nothing on screen used to say so. The person either sat waiting
without knowing they could work, or went back to work and had the machine taken from them when
the next take began.

macOS only, like the screen capture itself. Windows is out of scope.

## What the runner does

- **Waits for hands off** (`scripts/idle.js`). One long-lived `python3` prints the system idle
  time four times a second (`CGEventSourceSecondsSinceLastEventType`). Before the browser opens,
  the runner waits until nobody has touched the machine for `recording.screenCapture.countdownSeconds`,
  counted from the later of the wait's start and the last touch — so someone already away still
  gets that long to see it coming. Before the first frame it waits again only if someone touched
  the machine since. No question is asked.
- **Yields mid-take.** Every async function a step script is handed is wrapped once: if someone
  touched the machine since the runner last had it, the action waits for hands off, the pointer
  is parked again, other applications are hidden again, the browser comes to the front, and the
  stretch is cut with `createCuts()`. The runbook names it. Synchronous ones (`mark()`) are not
  wrapped: step scripts call them without `await`.
- **Shows whose machine it is** (`scripts/status-item.js`). A detached accessory process
  (`osascript -l JavaScript`) puts the plugin's firefly in the menu bar while a take holds the
  machine: lantern amber + seconds while waiting, red and pulsing while recording, body in the
  wordmark's ink for the menu bar's appearance. It leaves when no live take holds a lock, so no
  firefly means the machine is free. The drawing is the favicon's, from
  `src/skills/recording/assets/firefly-mark.json`, which `docs/images/logo/build-firefly-assets.py`
  writes. The state lives in the take's own lock (`lock.update()`, written via rename so it is
  never seen half-written), so a crashed run puts the light out. One item per machine (pid file).

## Measured

- The runner's own `CGWarpMouseCursorPosition` moves do not reset the idle time: 10 warps over
  2 s, idle went 7.67 s → 9.79 s.
- A key posted to the HID tap does reset it: idle 3.2 s → 0.01 s after one shift down/up. So the
  file picker driver reports its own input, and input within 300 ms after it is not a person.
- The firefly renders amber with a countdown and red, a second `showStatusItem()` adds no second
  item, and it exits within a second of the lock being released.

- `tests/e2e/run-window.sh`, with shift taps posted to the HID tap standing in for a person: taps
  for the first 6 s held the countdown at 3 and the browser closed; one tap mid-take turned the
  state back to waiting for 3 s, and the runbook listed a 3.5 s stretch cut with both steps kept.
