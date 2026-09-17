# Terminal panel — sized to what it holds, revealed at a pace an eye can follow

## The gap this closes

The panel is one fixed height for the whole take, and it draws only the rows that fit:
`terminal.js` sends `screen.lines().slice(-rows)` on a 90ms timer. Everything that scrolled past
between two timer ticks was never drawn at all.

For a command that prints three lines that is invisible. For a command that prints a JSON response
of eighty lines into a panel thirteen rows tall, the video shows the last thirteen lines and no
frame of the other sixty-seven. A reviewer cannot pause on what was never in a frame, and the
recording quietly claims to show a result it does not show.

The same fixed height is wrong in the other direction too: a panel sized for the longest command
in the take covers the bottom of every frame for the whole take, including the commands that print
one line.

## What the panel becomes

- **Sized to the command it is showing.** It grows when the output needs the room and settles back
  when the next one needs less, both animated.
- **Never skipping a line.** The window over the output advances at a bounded speed. When output
  arrives faster than that, the panel falls behind and catches up afterwards; it does not jump.
- **Paced for a viewer, not for a reader.** Someone who wants to read a response pauses the video.
  The recording's job is to put every line in a frame, at a speed where pausing lands somewhere
  useful — not to hold still long enough for the whole body to be read.
- **Translucent**, so the page it is drawn over stays visible behind it.

## The numbers, and why each one

| | Value | Why |
|---|---|---|
| Idle height | title bar + 3 rows | Not zero: a panel that slides fully out and back between commands is motion that means nothing. Three rows keeps the shell present |
| Ceiling | `recording.terminal.height` | Unchanged as a number, changed in meaning: it was the fixed height, it is now the tallest the panel may become. A project that pinned 300px gets the same worst case as before and a smaller panel the rest of the time |
| Grow | 220ms, ease-out | Fast enough not to delay the output it is making room for |
| Shrink | 320ms | Slower than the grow. A panel that snaps down reads as a glitch |
| Settle after content appears | 500ms | Text that appears and moves in the same instant is text nobody's eye reached in time. The beat is what makes the panel feel addressed to someone |
| Scroll speed, floor | 8 rows/second | Reading pace. Short overflows use it |
| Scroll speed, ceiling | 20 rows/second | Above this, a paused frame is the only way to read anything, and pausing is the viewer's move to make |
| Scroll target | 6 seconds | Speed is chosen to finish the overflow in about this, between the floor and the ceiling |
| Warn above | 10 seconds of scrolling for one command | The panel still shows every line. The runner tells the operator to cut the output down instead |

Everything above is multiplied by the take's speed setting, the same way a click's pause is: a take
recorded at `speed: fast` scrolls proportionally faster.

## Too much output is a step-script problem

A response with five thousand lines in it is not a panel problem to solve by scrolling faster. It
is a step script that piped nothing into `jq` and dumped a body nobody will read.

So the runner does not truncate and does not fold: it shows every line, and prints one line of its
own naming the command and how long its output took to scroll, so the operator can cut it down and
record again. The full text is in the runbook either way.

## Where each half lives

`terminal-panel.js` states it holds no parsing: the runner decides, the page draws. Scrolling and
resizing are drawing, so they belong in the page.

The runner sends the window it wants — which rows, which height — and the page animates to it. It
does not send a new slice of rows every 90ms and let the browser cut between them: each of those is
a round trip, so the motion could never be smoother than eleven steps a second, and a line-by-line
cut is exactly the thing that makes output unreadable today.

## What this does not change

- `start()` and a command still streaming keep painting as they go. Nothing waits for a command to
  finish before showing its output — dead air in front of a slow request is worse than a fast scroll
  behind it. The panel grows during a stream and does not shrink until the command is over.
- The refusal to click an element the panel covers. It now measures the panel's real height at the
  moment of the click rather than the one number from the config, because that number is no longer
  what is on screen.
- Every existing step script. No call signature changes and nothing new is required to benefit.
