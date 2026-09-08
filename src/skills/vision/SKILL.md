---
name: vision
description: Look at what a recording actually shows, by tiling its frames into timestamped contact sheets you can read as images. Use when you need to know what happened in a video rather than take someone's word for it — checking a take you just recorded, finding where a layout breaks, locating the moment an error appeared, or answering a question about a video you cannot watch.
---

# vision

A video is not readable. You can read a picture, so this turns the video into pictures: one frame
every couple of seconds, each stamped with the time it came from, tiled into sheets.

Point it at any mp4 — a take from `webapp-evidence-recording`, or any other recording:

```bash
node scripts/contact-sheet.js <video.mp4> --out <directory>
```

It prints one line per sheet with the span that sheet covers, then you read the sheets as images.

## Why sheets and not the screenshots

A recording usually comes with screenshots already, and they are not the same thing. Screenshots are
taken where a step script decided to capture — so they show what somebody already knew to look for.
A sheet samples the whole take at an even cadence, which is where the unplanned things are: a layout
that breaks halfway through a transition, a banner that appears and disappears, a screen that never
finished loading.

If the question is "did the thing we meant to prove happen", the screenshots answer it faster. If
the question is "what actually happened", read a sheet.

## Reading one

Every tile carries `mm:ss` in its corner, the same shape the runbook's timeline uses. That is what
makes a finding usable: **name the time**, not the tile. "The header overlaps the table at 00:14" can
be checked in the mp4 and matched to a runbook line. "It looks broken in the third picture" cannot.

Scan for the things a still frame shows well: text overflowing its container, elements overlapping,
a layout that clearly does not fit the viewport, a blank or half-rendered screen, an error message.
Then say where, in time.

## When the defaults do not fit

One frame every 2s, four across and five down, 480px a tile — 20 tiles a sheet.

| The take | Try |
|---|---|
| Short, or something happens fast | `--every 1` |
| Long, and you want fewer sheets | `--every 4` or `--every 5` |
| Detail is too small to judge | `--tile 640 --columns 3` |
| You only need the shape of it | `--columns 6 --rows 4 --tile 320` |

`--help` lists them all, and is the way to find out what the script takes — reading
`contact-sheet.js` costs context and says nothing more. Sampling more often makes more sheets, not
bigger ones.

## What it needs

`ffmpeg` and `ffprobe`. If either is missing, say so and offer to install it — do not paste install
instructions, and do not install anything until the user agrees.

Timestamps need a font ffmpeg can load. It looks for the usual ones on macOS and Linux; if none is
found the sheets are still produced without stamps, and the tool prints the arithmetic for working
out a tile's time from its position. Say that in your report rather than guessing at times.
