#!/usr/bin/env bash
# Record the tour this site shows of itself, with this repository's own runner, and put what the page
# uses in place.
#
#   webapp/demo/record.sh                      records a fresh production build on a local preview
#   BASE_URL=https://evd.vercel.app webapp/demo/record.sh    records a deployment instead
#
# Needs Google Chrome, ffmpeg, Node and pnpm, and a few minutes. Writes, and these are committed:
#   public/demo/<take>.mp4             the web copy the How it works section plays
#   public/demo/<take>-poster.jpg      its first frame, shown before it plays
#   src/assets/demo/vision-sheet-NN.png  the take tiled by the vision skill
#   src/data/<take>-runbook.md         the sections of the runbook the UAT report quotes
# The full-resolution take and its screenshots stay in a temporary directory and are deleted.
set -euo pipefail

SITE="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
REPO="$(cd -- "$SITE/.." && pwd)"
SKILL="$REPO/src/skills/recording"
DEMO="$SITE/demo"
STEPS="$DEMO/tour-steps.cjs"
TAKE="$(node -p "require('$STEPS').name")"

# The web copy starts once the language walk is over — it redraws the whole page four times and is
# the least interesting stretch — and runs to the end of the take. Named by step, not by time: the
# times are read back from the runbook of the take just recorded. Labels are the mark() calls in
# tour-steps.cjs.
WEB_FIRST_STEP='Hero — the firefly answers the pointer'

# Scaled to the widest the page ever shows it, h264 so it plays everywhere, no audio track, and the
# index moved to the front so playback starts before the whole file has arrived.
WEB_WIDTH=1280
WEB_CRF=30

command -v ffmpeg >/dev/null || { printf 'record.sh: ffmpeg is required\n' >&2; exit 1; }
[ -d "$SKILL/scripts/node_modules" ] \
  || { printf 'record.sh: run npm install --prefix %s/scripts first\n' "$SKILL" >&2; exit 1; }

OUT_DIR="$(mktemp -d "${TMPDIR:-/tmp}/evd-tour.XXXXXX")"
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
  curl -fsS "$BASE_URL/" 2>/dev/null | grep -q 'data-uat-report' \
    || { printf 'record.sh: %s is not serving this site\n' "$BASE_URL" >&2; exit 1; }
fi

printf 'recording %s\n' "$BASE_URL"
OUT_DIR="$OUT_DIR" BASE_URL="$BASE_URL" EVIDENCE_CONFIG="$DEMO/evidence.config.cjs" CAPTIONS=on CAPTION_LOCALE=en \
  node "$SKILL/scripts/record.js" "$STEPS" >/dev/null

RUNBOOK="$OUT_DIR/$TAKE-runbook.md"
VIDEO="$OUT_DIR/$TAKE.mp4"

# Timeline lines read "mm:ss - mm:ss  <the label passed to mark()>"; field 1 is where a step begins.
step_start() {
  local time
  time="$(awk -v label="$1" '/^[0-9][0-9]:[0-9][0-9] - [0-9][0-9]:[0-9][0-9]/ && index($0, label) { print $1; exit }' "$RUNBOOK")"
  [ -n "$time" ] || { printf 'record.sh: no step named "%s" in %s\n' "$1" "$RUNBOOK" >&2; exit 1; }
  printf '%s' "$(( 10#${time%%:*} * 60 + 10#${time##*:} ))"
}
FROM="$(step_start "$WEB_FIRST_STEP")"

mkdir -p "$SITE/public/demo" "$SITE/src/assets/demo" "$SITE/src/data"
WEB="$SITE/public/demo/$TAKE.mp4"
POSTER="$SITE/public/demo/$TAKE-poster.jpg"

printf 'encoding the web copy from %ss\n' "$FROM"
ffmpeg -v error -y -ss "$FROM" -i "$VIDEO" -an \
  -vf "scale=$WEB_WIDTH:-2:flags=lanczos" -c:v libx264 -crf "$WEB_CRF" -preset slow -pix_fmt yuv420p \
  -movflags +faststart "$WEB"
ffmpeg -v error -y -i "$WEB" -frames:v 1 -q:v 4 "$POSTER"
printf 'done — %s (%s), %s\n' "$WEB" "$(du -h "$WEB" | cut -f1)" "$POSTER"

# The whole take read back the way the vision skill reads one, so the sheets on the page come from
# the recording beside them rather than from a different run.
printf 'tiling it into contact sheets\n'
rm -f -- "$SITE"/src/assets/demo/vision-sheet-*.png
node "$REPO/src/skills/vision/scripts/contact-sheet.js" "$VIDEO" \
  --every 2 --columns 4 --rows 5 --out "$OUT_DIR" >/dev/null
i=1
for sheet in "$OUT_DIR/$TAKE"-sheet-*.png; do
  cp -- "$sheet" "$SITE/src/assets/demo/$(printf 'vision-sheet-%02d.png' "$i")"
  i=$((i + 1))
done
printf 'done — %s sheets\n' "$((i - 1))"

# The page quotes three sections of the runbook, and only those are kept: the rest names paths on
# the machine that recorded it. Each section is copied whole, line for line.
KEEP='## Steps in the video|## Commands run in the terminal|## Page errors recorded during the take'
awk -v keep="$KEEP" '
  /^## / { on = ($0 ~ "^(" keep ")$") }
  on { print }
' "$RUNBOOK" > "$SITE/src/data/$TAKE-runbook.md"
[ "$(grep -c '^## ' "$SITE/src/data/$TAKE-runbook.md")" -eq 3 ] \
  || { printf 'record.sh: the runbook no longer has the three sections the page quotes\n' >&2; exit 1; }
printf 'done — src/data/%s-runbook.md\n\nRebuild the site: it reads all of the above at build time.\n' "$TAKE"
