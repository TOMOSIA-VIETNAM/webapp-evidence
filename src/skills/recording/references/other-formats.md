# Converting a take to another format

Read this when the take has to go somewhere an mp4 does not fit.

```bash
node scripts/convert.js <video.mp4> --to gif        # or --to webm, or --to gif,webm
```

Each output lands beside the video unless `--out` says otherwise, and the size of every file is
printed. `--help` lists the options.

## Which format for where

| Destination | Format | Why |
|---|---|---|
| A merge request, an issue, a chat message | mp4 as recorded | GitHub, GitLab and every chat tool play it inline, and it is the smallest of the three |
| A README, or anywhere that only renders images | gif | An mp4 committed to a repository does not play in a README; a gif does |
| A web page you control | webm | Plays like a video, and on screen content lands well under the mp4 |

Do not convert on a hunch. An mp4 is the right answer most of the time, and a gif of the same take
is several times larger — offer the conversion, name the trade, and let the user decide.

## The gif trade

A gif has no inter-frame compression worth the name, so its size is roughly frames × pixels. A
36-second take at 1024px and 8fps comes out around 1.4 MB; the mp4 of the same take is 520 KB and
looks better.

Two settings decide the result, and the defaults are chosen for screen recordings rather than
photographs:

- **Width.** A gif displayed wider than it was encoded gets scaled up by the browser, and the text in
  it goes soft. Encode it at least as wide as it will be shown — the default 1024 covers a README
  that displays at 820.
- **No dithering.** Dither fakes colours a limited palette cannot hold, which matters for
  photographs. A UI is flat greys and small text, so the fake pixels land on the letters. The palette
  is built from the footage itself, which covers a screen recording comfortably at 128 colours.

To make it smaller, drop the frame rate before the width: `--fps 6` costs smoothness, `--width 600`
costs the ability to read anything.

## The webm trade

VP9 at `--crf 34` holds screen content well and keeps the source resolution. Lower crf means better
quality and a bigger file; 30 is visibly cleaner, 40 starts to smear text.

The catch is where it plays. A webm does not embed in a GitHub comment or a README, so it is for a
page you control or a viewer you know accepts it. When in doubt, send the mp4.
