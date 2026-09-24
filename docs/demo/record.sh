#!/usr/bin/env bash
# Record the demo the README and the site show, and print the runbook that came with it.
#
#   docs/demo/record.sh                                  a fresh build of webapp/ on a local preview
#   BASE_URL=https://evd.vercel.app docs/demo/record.sh  the deployed site
#
# It records the project's own landing page through this repository's own runner, so a reader sees
# real output rather than a mock-up. Needs Google Chrome, ffmpeg, Node and pnpm, and a few minutes.
#
# Everything below lands in docs/demo/ and is committed; the full-resolution take and its
# screenshots stay in a temporary directory and are deleted:
#   <take>.gif               the README's recording
#   <take>.mp4, -poster.jpg  the web copy the site plays under How it works, and its first frame
#   vision-sheet-NN.png      the take tiled by the vision skill, linked by the README, shown by the site
#   <take>-runbook.md        the three sections of the runbook the site's UAT report quotes
# The runbook is printed at the end because the README quotes from it, and quoting something you
# have not just regenerated is how a README drifts away from the thing it describes.
set -euo pipefail

REPO="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
SKILL="$REPO/src/skills/recording"
SITE="$REPO/webapp"
DEMO="$REPO/docs/demo"
STEPS="$DEMO/tour-steps.js"
TAKE="$(node -p "require('$STEPS').name")"

# The web copy and the gif both skip the take's first second of the page settling. The web copy
# runs to the end; the gif stops once the UAT report has been picked through, the part of the tour
# worth a README. Named by step, not by time: the times are read back from the runbook of the take
# just recorded. Labels are the mark() calls in tour-steps.js.
FIRST_STEP='Hero — the firefly answers the pointer'
GIF_LAST_STEP='UAT report —'

# The web copy: the widest the site ever shows it, h264 so it plays everywhere, no audio, and the
# index at the front so playback starts before the whole file has arrived.
WEB_WIDTH=1280
WEB_CRF=30

# A README gif is downloaded by everyone who opens the page, so the frame rate and the palette are
# cut well below the video's; on a take that scrolls, those are the levers that move the size.
#
# Wider than the README displays it (820): a browser scaling a gif UP is what makes it look soft,
# while scaling one down keeps text crisp.
#
# No dithering. Dither fakes missing colours in photographs; on flat UI and small text it sprays
# noise over the letters. diff_mode=rectangle, so a frame only carries the box that changed.
GIF_FPS=5
GIF_WIDTH=960
GIF_COLORS=48

# The contact sheets: 20 tiles each, and exactly this many sheets, full. The interval is worked out
# from the length of the take rather than fixed, so the last sheet never trails off into empty tiles.
SHEETS=3
SHEET_TILES=20

command -v ffmpeg >/dev/null || { printf 'record.sh: ffmpeg is required\n' >&2; exit 1; }
[ -d "$SKILL/scripts/node_modules" ] \
  || { printf 'record.sh: run npm install --prefix %s/scripts first\n' "$SKILL" >&2; exit 1; }

OUT_DIR="$(mktemp -d "${TMPDIR:-/tmp}/$TAKE.XXXXXX")"
PREVIEW_PID=
# A failed take keeps its directory: the partial video is what says where it went wrong.
cleanup() {
  local status=$?
  [ -z "$PREVIEW_PID" ] || kill "$PREVIEW_PID" 2>/dev/null || true
  if [ "$status" -eq 0 ]; then rm -rf -- "$OUT_DIR"; else printf 'kept %s\n' "$OUT_DIR" >&2; fi
}
trap cleanup EXIT

if [ -z "${BASE_URL:-}" ]; then
  printf 'building the site\n'
  (cd "$SITE" && pnpm build >/dev/null)
  # A port nobody holds, asked of the OS: another project's preview on the usual port would
  # otherwise answer, and the take would record the wrong site without a word.
  PORT="$(node -e "const s=require('net').createServer().listen(0,()=>{console.log(s.address().port);s.close()})")"
  # astro itself, not pnpm around it, so the pid killed on exit is the server's own.
  (cd "$SITE" && exec ./node_modules/.bin/astro preview --port "$PORT" >/dev/null 2>&1) &
  PREVIEW_PID=$!
  BASE_URL="http://localhost:$PORT"
  for _ in $(seq 1 60); do
    curl -fsS -o /dev/null "$BASE_URL/" 2>/dev/null && break
    sleep 0.5
  done
fi
curl -fsS "$BASE_URL/" 2>/dev/null | grep -q 'data-uat-report' \
  || { printf 'record.sh: %s is not serving the webapp-evidence site\n' "$BASE_URL" >&2; exit 1; }

printf 'recording %s\n' "$BASE_URL"
OUT_DIR="$OUT_DIR" BASE_URL="$BASE_URL" EVIDENCE_CONFIG="$DEMO/tour.config.js" CAPTIONS=on CAPTION_LOCALE=en \
  node "$SKILL/scripts/record.js" "$STEPS" >/dev/null

RUNBOOK="$OUT_DIR/$TAKE-runbook.md"
VIDEO="$OUT_DIR/$TAKE.mp4"

# Timeline lines read "mm:ss - mm:ss  <the label passed to mark()>"; field 1 is where a step
# begins, field 3 where it ends.
step_time() { # <label> <field>
  local time
  time="$(awk -v label="$1" -v field="$2" \
    '/^[0-9][0-9]:[0-9][0-9] - [0-9][0-9]:[0-9][0-9]/ && index($0, label) { print $field; exit }' "$RUNBOOK")"
  [ -n "$time" ] || { printf 'record.sh: no step named "%s" in %s\n' "$1" "$RUNBOOK" >&2; exit 1; }
  printf '%s' "$(( 10#${time%%:*} * 60 + 10#${time##*:} ))"
}
FROM="$(step_time "$FIRST_STEP" 1)"
GIF_TO="$(step_time "$GIF_LAST_STEP" 3)"

printf 'encoding the web copy from %ss\n' "$FROM"
ffmpeg -v error -y -ss "$FROM" -i "$VIDEO" -an \
  -vf "scale=$WEB_WIDTH:-2:flags=lanczos" -c:v libx264 -crf "$WEB_CRF" -preset slow -pix_fmt yuv420p \
  -movflags +faststart "$DEMO/$TAKE.mp4"
ffmpeg -v error -y -i "$DEMO/$TAKE.mp4" -frames:v 1 -q:v 4 "$DEMO/$TAKE-poster.jpg"

printf 'converting %ss..%ss to the gif\n' "$FROM" "$GIF_TO"
PALETTE="$OUT_DIR/palette.png"
# -ss and -t before -i, as input options: after -i they would trim the output instead, and
# palettegen — one frame written at the end — would have nothing left to write.
ffmpeg -v error -y -ss "$FROM" -t "$((GIF_TO - FROM))" -i "$VIDEO" \
  -vf "fps=$GIF_FPS,scale=$GIF_WIDTH:-1:flags=lanczos,palettegen=stats_mode=diff:max_colors=$GIF_COLORS" "$PALETTE"
ffmpeg -v error -y -ss "$FROM" -t "$((GIF_TO - FROM))" -i "$VIDEO" -i "$PALETTE" \
  -lavfi "fps=$GIF_FPS,scale=$GIF_WIDTH:-1:flags=lanczos[v];[v][1:v]paletteuse=dither=none:diff_mode=rectangle" \
  "$DEMO/$TAKE.gif"
printf 'done — %s.gif (%s), %s.mp4 (%s)\n' "$TAKE" "$(du -h "$DEMO/$TAKE.gif" | cut -f1)" "$TAKE" "$(du -h "$DEMO/$TAKE.mp4" | cut -f1)"

# The whole take read back the way the vision skill reads one. Frames are sampled at 0, e, 2e … so
# SHEETS x SHEET_TILES of them span the take when e is its length over that count; the input is cut
# half an interval short so rounding at the very end cannot add one frame and open a sheet of its own.
printf 'tiling it into contact sheets\n'
DURATION="$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$VIDEO")"
FRAMES=$((SHEETS * SHEET_TILES))
EVERY="$(awk -v d="$DURATION" -v n="$FRAMES" 'BEGIN { printf "%.3f", d / n }')"
LENGTH="$(awk -v e="$EVERY" -v n="$FRAMES" 'BEGIN { printf "%.3f", e * (n - 0.5) }')"
ffmpeg -v error -y -t "$LENGTH" -i "$VIDEO" -c copy "$OUT_DIR/sheets.mp4"
rm -f -- "$DEMO"/vision-sheet-*.png
node "$REPO/src/skills/vision/scripts/contact-sheet.js" "$OUT_DIR/sheets.mp4" \
  --every "$EVERY" --columns 4 --rows 5 --out "$OUT_DIR" >/dev/null
count=0
for sheet in "$OUT_DIR"/sheets-sheet-*.png; do
  count=$((count + 1))
  cp -- "$sheet" "$DEMO/$(printf 'vision-sheet-%02d.png' "$count")"
done
[ "$count" -eq "$SHEETS" ] || { printf 'record.sh: %s sheets instead of %s\n' "$count" "$SHEETS" >&2; exit 1; }
printf 'done — %s sheets, a frame every %ss\n' "$count" "$EVERY"

# The site quotes three sections of the runbook, and only those are kept: the rest names paths on
# the machine that recorded it. Each section is copied whole, line for line.
KEEP='## Steps in the video|## Commands run in the terminal|## Page errors recorded during the take'
awk -v keep="$KEEP" '/^## / { on = ($0 ~ "^(" keep ")$") } on { print }' "$RUNBOOK" > "$DEMO/$TAKE-runbook.md"
[ "$(grep -c '^## ' "$DEMO/$TAKE-runbook.md")" -eq 3 ] \
  || { printf 'record.sh: the runbook no longer has the three sections the site quotes\n' >&2; exit 1; }

printf -- '\n---- the runbook this take produced ----\n\n'
cat "$RUNBOOK"
