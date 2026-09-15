# Keeping something out of the finished video

Read this when the flow puts something on screen that must not survive into the evidence: an API
key, a token, a real customer's details.

Decide it while writing the step script. It costs nothing there, and nothing afterwards can be
relied on to find what was missed.

## Cover what can be read

A password field already shows `••••••`. Blurring it hides nothing, and what the viewer gets
instead is a smear where a form field was — a page that looks broken in the one recording meant
to show it working. The same goes for a masked card number, a token the application already
truncates, an avatar.

So the test is what a person watching could read off the screen, not what the field is called.
A value that is on screen in full is worth covering; one the application has already hidden is
not, and covering it costs the take its credibility.

Everything else about writing a step script is in `writing-step-scripts.md`.

Whoever wrote the step knows exactly when it appears, so they say so, and nothing has to be
found afterwards:

```js
await redact(page.locator('#api_key'), async () => {
  await click(page.getByRole('button', { name: 'Reveal' }), { pause: 'observe' });
  await shot('key-revealed');          // masked in the screenshot too
});
```

| mode | What it does | When |
|---|---|---|
| `blur` (default) | blurs the region for that stretch | something is there and its shape still tells the story |
| `box` | fills it with a solid block | the value must be unreadable, not merely hard to read |
| `cut` | removes the stretch from the video | it should never have been recorded at all |

Pass `'frame'` instead of a locator when the position is not known: `redact('frame', body)`.

**`cut` moves every timestamp after it.** The runbook is rebuilt against the shortened video, and
rows that fell inside the cut are dropped. That is handled, but it means the runbook of a take
with a cut cannot be compared against one without.

`shot()` inside a region window is masked over the same element by Playwright. Inside a `'frame'`
window, or a `cut` one, it is refused: an entirely blacked screenshot proves nothing, and a
screenshot of a stretch being removed defeats the point of removing it.

The runbook lists what was covered, when and where. A blurred rectangle in the middle of a video
reads as a rendering fault unless the reader is told it was deliberate.

Terminal output is separate: `recording.terminal.scrub` blacks out patterns before they are drawn
at all, so they never reach a frame to be blurred.

