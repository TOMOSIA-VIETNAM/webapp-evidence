#!/usr/bin/env bash
# Re-record the demo in the README, and print the runbook that came with it.
#
#   docs/demo/record.sh
#
# It records open-pr.vercel.app — a public landing page with no account and no data behind it —
# through this repository's own runner, so a reader sees real output rather than a mock-up. Needs
# Google Chrome, ffmpeg and Node, and about three minutes.
#
# The recording goes to a temporary directory. Only the gif the README embeds and the vision
# contact sheets it links land in the repository — the video itself is a good deal larger than
# both together, and nothing in the README points at it.
# The runbook is printed at the end because the README quotes from it, and quoting something you
# have not just regenerated is how a README drifts away from the thing it describes.
set -euo pipefail

REPO="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
SKILL="$REPO/src/skills/recording"
DEMO="$REPO/docs/demo"
GIF="$DEMO/site-tour.gif"
TAKE=site-tour

# A README gif is downloaded by everyone who opens the page, so the frame rate and the palette are
# both cut well below the video's. This take scrolls nearly the whole way through, which means
# almost every frame differs from the one before it and a palette built on the differences saves
# very little — the frame rate and the colour count are the levers that actually move the size.
#
# The width is the size the README displays the gif at. Wider spends bytes the reader never sees;
# narrower gets scaled UP by the browser, which is what makes a recording look soft.
#
# No dithering. Dither exists to fake missing colours in photographs; on flat UI greys and small
# text it just sprays noise over the letters. diff_mode=rectangle on top of that, so a frame only
# carries the box that changed rather than the whole screen.
FPS=6
WIDTH=820
COLORS=64

# The gif shows one stretch of the take, not all of it. It starts after the language walk, which
# redraws the whole page five times over and costs more gif than every other step together, and it
# stops once the page has been read down to the feature cards. The take carries on past that; the
# gif is the part of it worth a README.
#
# The window is named by the steps at its ends rather than by a timestamp, and the times are read
# back out of the runbook of the take that was just recorded — a number written in here would be
# wrong the first time a step changed length. The labels come from the mark() calls in
# docs/demo/site-tour-steps.js; rename a mark there and the matching name here has to follow.
GIF_FIRST_STEP='Hero — the moth'
GIF_LAST_STEP='Features —'

command -v ffmpeg >/dev/null || { printf 'record.sh: ffmpeg is required\n' >&2; exit 1; }
[ -d "$SKILL/scripts/node_modules" ] \
  || { printf 'record.sh: run npm install --prefix %s/scripts first\n' "$SKILL" >&2; exit 1; }

OUT_DIR="$(mktemp -d "${TMPDIR:-/tmp}/webapp-evidence-demo.XXXXXX")"
trap 'rm -rf -- "$OUT_DIR"' EXIT

printf 'recording the tour\n'
OUT_DIR="$OUT_DIR" EVIDENCE_CONFIG="$DEMO/evidence.config.js" CAPTIONS=on CAPTION_LOCALE=en \
  node "$SKILL/scripts/record.js" "$DEMO/$TAKE-steps.js" >/dev/null

RUNBOOK="$OUT_DIR/$TAKE-runbook.md"
VIDEO="$OUT_DIR/$TAKE.mp4"

# The timeline lines of the runbook read "mm:ss - mm:ss  <the label passed to mark()>". Field 1 is
# where a step begins, field 3 is where it ends.
step_time() { # <label> <field: 1 begins, 3 ends>
  local time
  time="$(awk -v label="$1" -v field="$2" \
    '/^[0-9][0-9]:[0-9][0-9] - [0-9][0-9]:[0-9][0-9]/ && index($0, label) { print $field; exit }' \
    "$RUNBOOK")"
  [ -n "$time" ] || { printf 'record.sh: no step named "%s" in %s\n' "$1" "$RUNBOOK" >&2; exit 1; }
  printf '%s' "$(( 10#${time%%:*} * 60 + 10#${time##*:} ))"
}

FROM="$(step_time "$GIF_FIRST_STEP" 1)"
TO="$(step_time "$GIF_LAST_STEP" 3)"
LENGTH=$(( TO - FROM ))
[ "$LENGTH" -gt 0 ] || { printf 'record.sh: "%s" ends before "%s" begins\n' "$GIF_LAST_STEP" "$GIF_FIRST_STEP" >&2; exit 1; }

printf 'converting %ss..%ss to %s\n' "$FROM" "$TO" "$GIF"
PALETTE="$OUT_DIR/palette.png"
# -ss and -t go before -i, where they are input options: after -i they would trim the output
# timeline instead, and palettegen — which emits a single frame at the end — would have nothing
# left to write. Seeking an input that is being re-encoded is frame-accurate, so the gif starts on
# the step it was asked for.
ffmpeg -v error -y -ss "$FROM" -t "$LENGTH" -i "$VIDEO" \
  -vf "fps=$FPS,scale=$WIDTH:-1:flags=lanczos,palettegen=stats_mode=diff:max_colors=$COLORS" "$PALETTE"
ffmpeg -v error -y -ss "$FROM" -t "$LENGTH" -i "$VIDEO" -i "$PALETTE" \
  -lavfi "fps=$FPS,scale=$WIDTH:-1:flags=lanczos[v];[v][1:v]paletteuse=dither=none:diff_mode=rectangle" \
  "$GIF"
printf 'done — %s (%s)\n' "$GIF" "$(du -h "$GIF" | cut -f1)"

# The same take read back the way the vision skill reads one, so the sheets the README links to come
# from the recording it shows rather than from a different run.
printf '\ntiling it into contact sheets\n'
rm -f -- "$DEMO"/vision-sheet-*.png
node "$REPO/src/skills/vision/scripts/contact-sheet.js" "$VIDEO" \
  --every 2 --columns 4 --rows 5 --out "$OUT_DIR" >/dev/null
i=1
for sheet in "$OUT_DIR/$TAKE"-sheet-*.png; do
  target="$DEMO/$(printf 'vision-sheet-%02d.png' "$i")"
  cp -- "$sheet" "$target"
  printf 'done — %s (%s)\n' "$target" "$(du -h "$target" | cut -f1)"
  i=$((i + 1))
done

printf -- '\n---- the runbook this take produced ----\n\n'
cat "$RUNBOOK"
