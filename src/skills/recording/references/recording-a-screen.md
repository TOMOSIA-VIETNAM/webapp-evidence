# Recording more than the page

The default records page content: Playwright drives Chrome headless and the video is the page.
It needs no permission, no screen and nobody's cooperation, and it is right for almost every
take. This file is for the takes it is not right for.

Read it when the evidence is one of these, and not before.

## The three backends

`recording.capture` picks one. Take the cheapest that proves the claim.

| The claim | What records it | What it costs |
|---|---|---|
| Anything happening on the page | `page` — the default | nothing. Headless, no permission, runs in CI |
| The click reached a worker, wrote a file, moved a row | `page`, plus `term` in the step script | nothing. The shell runs in the page |
| A `<select>` menu, the file picker, `confirm`/`alert`, DevTools | `window` | a screen, permission, and the machine to itself |
| Something outside the browser entirely | `screen` | the same, and everything else on that display is in the video |

The second row is a step-script helper rather than a backend, and it is documented with the
others in `references/writing-step-scripts.md`. It is here because it answers the question this
file is usually opened with — "the page does not show it" — without any of the cost below it.

Measured on macOS, so it does not have to be guessed: with `window`, the menu a `<select>` opens
is in the video, the browser's dialogs are, and DevTools is. DevTools takes its room out of the
page area while the page still renders at its configured width, so the application appears cut
off down the right-hand side; lower `recording.viewport.width` if that side matters.

## What actually reaches the video

Worth knowing before deciding how much to worry, because the two backends are not the same risk.

`window` crops to the browser window, so nothing outside it can be in the frame — not another
application, not the desktop, not the Dock. The window is opened at the top left, and
notification banners arrive at the top right, so on any display wider than the window one cannot
land in it either. The window is not made smaller to achieve this and there is no reason to
shrink it: the crop is what excludes things, not the size.

`screen` records the display, all of it. Everything on it is in the video. If that is what the
evidence needs, say so plainly when asking, and it is worth suggesting they move the browser to
an empty desktop first — a new Space on macOS, a new virtual desktop on Windows. Neither can be
created from a script, so it is a request, not a step.

### The browser's own offers

Chrome raises things of its own over the page: an offer to translate, an offer to save a
password, a first-run panel. They are turned off at launch where a switch does it.

The translate bubble took three attempts, and the two that failed are worth knowing so nobody
tries them again: `--disable-features=Translate` does not stop it, with the switch confirmed on
Chrome's own command line and the bubble still on screen; nor does setting `recording.locale` to
the page's own language.

What the runner does now is say it from the page — the `notranslate` meta tag Chrome reads when
it decides. Nothing about it is configured, and nothing about it changes the page's layout,
appearance or behaviour.

### Permission, and what the entry is called

macOS asks for Screen Recording permission per application, and the entry it creates carries
the name of whichever application the request is attributed to — which is the agent's host, not
this skill. It can read as a version number rather than a name, and a version number in a
privacy setting is a thing people turn off. Say what it is when asking, and say that turning it
off stops every window capture.

### The operator's own pointer

A window capture records the real mouse pointer wherever it was left, and asking avfoundation not
to makes no difference — measured. Playwright clicks through the browser rather than by moving the
pointer, so it never moves during a take: what the video holds is a second, motionless arrow
beside the one the runner draws and does move.

Nothing in the runner can move it. The notice asks the operator to park it off the browser window
before they answer, which is the only place that can be asked.

Neither backend can keep out something drawn *on top of* the browser: a notification that lands
there, another application brought to the front. That is what the Do Not Disturb line in the
notice is for, and why the machine has to be left alone.

Recording one display while the operator keeps working on another is the best answer to all of
this, and it is not implemented — `backlogs/screen-capture/other-platforms.md` says what it
needs. Today the browser is always on the primary display and that is the one recorded.

## Asking before recording a screen

The person at that machine has to agree, and has to stop using it. They are probably not looking
at the terminal — they may not know a recording was asked for at all. So the notice goes to the
screen first and the question goes to them second, in that order:

1. **Put the notice up**, and write it yourself, in the language they write in:

   ```bash
   node scripts/announce.js --message "<what it says>"
   ```

   `--help` says what the sentence has to cover — nothing is being recorded yet, turn on Do Not
   Disturb, press OK and come back here — and shows an example. Nothing here holds a list of
   languages: you are already talking to this person, so write it the way you have been.

   It floats above whatever they are looking at, and it is the only thing that appears on that
   screen. **It waits to be pressed** — a notice that dismisses itself is one they may never
   see, and this is the one thing they have to have seen. The command does not return until
   they press it, so ask afterwards, not before.

   It exits non-zero if nobody presses it within five minutes. That is nobody at the machine,
   not consent: say so and stop, rather than recording an empty chair.

2. **Ask in the terminal**, with the structured question tool where the agent has one (Claude Code's
   `AskUserQuestion`), otherwise as one chat message. Ask one question with three answers, and
   say what each one means:

   | Answer | What it means |
   |---|---|
   | Record the screen (recommended when a native dialog is the evidence) | They hand the machine over for about a minute and do not touch it |
   | Record the page instead | Headless, they keep using the machine, and what the operating system draws is missing |
   | Not now | Nothing is recorded |

3. **Only on the first answer**, record with `SCREEN_CAPTURE=1`:

   ```bash
   OUT_DIR=<the evidence directory> SCREEN_CAPTURE=1 \
     node scripts/record.js <path to steps.js>
   ```

   The runner refuses without that variable, and it cannot ask for it itself: started through a
   shell, a prompt on stdin waits forever. Passing it is the agent saying the person agreed.

   Their answer is the handover — nothing else appears on their screen, because by then
   they have read the notice, turned off notifications and walked back to this terminal. A few
   seconds after they answer, the first frame is recorded.

From the moment they answer, the machine is the agent's. Do not ask them anything else until the
take is finished, and tell them plainly when it is.

Afterwards, look at the recording once with the `vision` skill before handing it over, and
report what you find with timestamps. It holds whatever was on that screen. This is a last look
for the user to act on, not a filter: say what you saw and let them decide, rather than
declaring the video clean.

## Configuration

`recording.capture` picks the backend, and `recording.screenCapture` holds the rest — the frame
rate, which display, the seconds before the first frame, and a ceiling on the recording so a
runner that dies cannot leave one going. `assets/evidence.config.example.js` has them written
out with what each one is for, and `scripts/record.js --help` lists the environment variables
that override them for a single run.

`recording.devtools` opens DevTools alongside the page. Only a window capture can see it.

## What is not implemented

- **Linux and Windows.** Each numbers its capture devices, reports its pixels and answers a stop
  request differently, and only macOS could be tested. The runner refuses elsewhere by name and
  points at the page backend.
- **A second display**, which is the strongest answer to what else ends up in a video: the
  operator keeps working on one screen while the other is recorded. The window is always opened
  on the primary.
- **Full screen, `--app`, `--kiosk`**, all considered and turned down — they change how much of
  the *browser* is in the frame, not what else is, and the address bar is usually part of the
  evidence.

`backlogs/screen-capture/other-platforms.md` in this repository has the reasoning and what each
one would need.
