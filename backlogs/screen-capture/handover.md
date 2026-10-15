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
- **Shows whose machine it is** (`scripts/status-item.js`). A detached accessory process draws a
  menu bar dot: grey free, yellow + seconds waiting, red recording. The state lives in the take's
  own lock (`lock.update()`, written via rename so it is never seen half-written), so a crashed
  run reads as grey. One item per machine (pid file); it exits after 30 minutes of grey.

## Measured

- The runner's own `CGWarpMouseCursorPosition` moves do not reset the idle time: 10 warps over
  2 s, idle went 7.67 s → 9.79 s.
- A key posted to the HID tap does reset it: idle 3.2 s → 0.01 s after one shift down/up. So the
  file picker driver reports its own input, and input within 300 ms after it is not a person.
- The status item renders all three states and a second `showStatusItem()` adds no second item.

## Not yet run

`tests/e2e/run-window.sh` with someone moving the mouse when it starts (the take should not open
the browser until they stop), and nudging the mouse mid-take (the take should come out with that
stretch cut). Both need the machine for about a minute.
