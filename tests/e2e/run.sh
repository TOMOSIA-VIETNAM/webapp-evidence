#!/usr/bin/env bash
# End-to-end check: serve the demo app, record it with the real runner in a real browser, and assert
# on what lands on disk. The unit tests cover the decisions; this covers the one thing they cannot —
# that a recording actually happens and produces a video, screenshots and a runbook.
#
#   tests/e2e/run.sh            record, check the output, print where it is, then delete it
#   tests/e2e/run.sh --keep     leave the output in place so you can watch the video
#
# Needs Google Chrome, ffmpeg and Node. Exits non-zero on the first failed check.
set -euo pipefail

# `awk 'NR==1'` rather than `head -1` throughout: head closes the pipe once it has its line, the
# process feeding it dies of SIGPIPE, and `pipefail` turns that into the whole check exiting with
# no message. awk reads to the end.

REPO="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
SKILL="$REPO/src/skills/recording"
KEEP=no
[ "${1:-}" = "--keep" ] && KEEP=yes

fail() { printf '\nFAILED: %s\n' "$1" >&2; exit 1; }
step() { printf '\n== %s\n' "$1"; }

for tool in node ffmpeg; do
  command -v "$tool" >/dev/null || fail "$tool is not on PATH"
done
[ -d "$SKILL/scripts/node_modules" ] \
  || fail "runner dependency missing — run: npm install --prefix $SKILL/scripts"

# Everything the run produces goes outside the repository: the runner refuses to write inside the
# skill, and a stray video in the working tree is exactly what this project tells people to avoid.
OUT_DIR="$(mktemp -d "${TMPDIR:-/tmp}/webapp-evidence-e2e.XXXXXX")"
SERVER_PID=

cleanup() {
  [ -n "$SERVER_PID" ] && kill "$SERVER_PID" 2>/dev/null || true
  if [ "$KEEP" = yes ]; then
    printf '\nOutput kept in %s\n' "$OUT_DIR"
  else
    rm -rf -- "$OUT_DIR"
  fi
}
trap cleanup EXIT

# The demo app's "Run sync" button writes here, and the recording reads it back in the terminal
# panel — the one claim in this take that the browser cannot make on its own.
export DEMO_LOG="$OUT_DIR/worker.log"
: >"$DEMO_LOG"

step "Serving the demo app"
# The port is chosen by the OS, so two runs at once do not collide.
SERVER_OUT="$OUT_DIR/.server"
node "$REPO/tests/e2e/serve.js" >"$SERVER_OUT" 2>&1 &
SERVER_PID=$!
for _ in $(seq 1 50); do
  [ -s "$SERVER_OUT" ] && break
  sleep 0.1
done
BASE_URL="$(head -1 "$SERVER_OUT")"
case "$BASE_URL" in http://127.0.0.1:*) ;; *) fail "the demo server did not start: $(cat "$SERVER_OUT")" ;; esac
printf '%s\n' "$BASE_URL"

step "Recording"
# No evidence.config.js anywhere: this is the same path a non-technical user takes when all they
# have is a URL, so the check covers that fallback too.
BASE_URL="$BASE_URL" OUT_DIR="$OUT_DIR" CAPTIONS=on CAPTION_LOCALE=en \
  node "$SKILL/scripts/record.js" "$REPO/tests/e2e/steps.js"

step "Checking what landed"
NAME=e2e-user-search
VIDEO="$OUT_DIR/$NAME.mp4"
RUNBOOK="$OUT_DIR/$NAME-runbook.md"

[ -f "$VIDEO" ] || fail "no video at $VIDEO"
# A video that exists but holds nothing is the failure this check is really for.
SIZE=$(wc -c <"$VIDEO" | tr -d ' ')
[ "$SIZE" -gt 20000 ] || fail "video is only $SIZE bytes, so nothing was recorded"
ffprobe -v error -select_streams v:0 -show_entries stream=codec_name -of csv=p=0 "$VIDEO" \
  | grep -q h264 || fail "video is not the h264 mp4 the runbook promises"
DURATION=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$VIDEO")
awk -v d="$DURATION" 'BEGIN { exit (d > 5) ? 0 : 1 }' \
  || fail "video is ${DURATION}s, too short to contain the six marked steps"

SHOTS=$(find "$OUT_DIR" -maxdepth 1 -name '[0-9][0-9]-*.png' | wc -l | tr -d ' ')
[ "$SHOTS" -ge 4 ] || fail "expected at least 4 screenshots, found $SHOTS"

[ -f "$RUNBOOK" ] || fail "no runbook at $RUNBOOK"
for phrase in 'Run the search' 'Open a row' 'Select all' 'demo fixture' 'BASE_URL' \
              'Commands run in the terminal' 'tail -f' 'wc -l' 'SyncJob'; do
  grep -qF -- "$phrase" "$RUNBOOK" || fail "the runbook never mentions '$phrase'"
done
grep -qE '^[0-9]{2}:[0-9]{2} - [0-9]{2}:[0-9]{2}' "$RUNBOOK" \
  || fail "the runbook has no timeline rows"

# Redaction has to hold in both places a frame ends up: the video and the screenshot taken while
# the value was on screen. The runbook says where it was covered, so the check reads the rectangle
# from there rather than guessing it or opening a second browser to measure it.
step "Checking the redaction"
grep -q '## Kept out of the video' "$RUNBOOK" || fail "the runbook does not record what was covered"
RECT="$(sed -n 's/.*covered with a solid block (\([0-9]*\)x\([0-9]*\) at \([0-9]*\),\([0-9]*\)).*/\1 \2 \3 \4/p' "$RUNBOOK" | awk 'NR==1')"
[ -n "$RECT" ] || fail "the runbook does not say where the API key was covered"
set -- $RECT
KW=$1 KH=$2 KX=$3 KY=$4

KEY_SHOT="$(find "$OUT_DIR" -maxdepth 1 -name '*-key-masked.png' | awk 'NR==1')"
[ -n "$KEY_SHOT" ] || fail "no screenshot was taken while the key was on screen"

# Playwright paints its own mask over the element: magenta, which is strongly positive on both
# chroma axes and matches nothing else in this black-on-white demo app.
SHOT_CHROMA="$(ffprobe -v error -f lavfi \
  -i "movie=${KEY_SHOT},crop=${KW}:${KH}:${KX}:${KY},signalstats" \
  -show_entries frame_tags=lavfi.signalstats.UAVG,lavfi.signalstats.VAVG -of csv=p=0)"
awk -F, -v h="$SHOT_CHROMA" 'BEGIN { split(h, c, ","); exit (c[1] > 150 && c[2] > 150) ? 0 : 1 }' \
  || fail "the API key is not masked in $KEY_SHOT (chroma $SHOT_CHROMA)"

# And in the video the same rectangle is filled black for the stretch it was on screen. The
# timestamp comes from the runbook too, taken a second in so the check does not land on the edge.
COVER_AT="$(sed -n 's/^- \([0-9]*\):\([0-9]*\) - .*covered with a solid block.*/\1 \2/p' "$RUNBOOK" | awk 'NR==1')"
set -- $COVER_AT
COVER_T=$(( 10#$1 * 60 + 10#$2 + 1 ))
# The frame is selected inside the graph rather than by seeking: ffprobe cannot seek a `movie=`
# input, and asking it to fails the whole check on something unrelated to the redaction.
COVER_LUMA="$(ffprobe -v error -f lavfi \
  -i "movie=${VIDEO},select='gte(t\,${COVER_T})',crop=${KW}:${KH}:${KX}:${KY},signalstats" \
  -show_entries frame_tags=lavfi.signalstats.YAVG -of csv=p=0 | awk 'NR==1')"
awk -v y="$COVER_LUMA" 'BEGIN { exit (y < 40) ? 0 : 1 }' \
  || fail "at ${COVER_T}s the API key region has brightness $COVER_LUMA, so it was not covered"

# The runbook can carry the command section while the panel never actually drew: the value of the
# terminal is that a reviewer SEES the log. The panel fills the bottom 300px of the frame with a
# near-black background, so the average brightness there says whether it rendered.
PANEL_SHOT="$(find "$OUT_DIR" -maxdepth 1 -name '*-worker-finished.png' | awk 'NR==1')"
[ -n "$PANEL_SHOT" ] || fail "no screenshot was taken while the terminal panel was open"
PANEL_LUMA="$(ffprobe -v error -f lavfi \
  -i "movie=${PANEL_SHOT},crop=iw:300:0:ih-300,signalstats" \
  -show_entries frame_tags=lavfi.signalstats.YAVG -of csv=p=0)"
awk -v y="$PANEL_LUMA" 'BEGIN { exit (y < 70) ? 0 : 1 }' \
  || fail "the bottom of $PANEL_SHOT has brightness $PANEL_LUMA, so the terminal panel did not draw"

# A console log is written only when the page misbehaved. The demo app is meant to be quiet.
[ -f "$OUT_DIR/$NAME-console.log" ] \
  && fail "the demo app reported page errors: $(cat "$OUT_DIR/$NAME-console.log")"

printf '\nPASSED\n'
printf '  video     %s (%s bytes, %.1fs)\n' "$VIDEO" "$SIZE" "$DURATION"
printf '  runbook   %s\n' "$RUNBOOK"
printf '  screenshots %s\n' "$SHOTS"
printf '  panel     drawn (brightness %s under the fold)\n' "$PANEL_LUMA"
printf '  redaction video %s, screenshot chroma %s\n' "$COVER_LUMA" "$SHOT_CHROMA"
[ "$KEEP" = yes ] || printf '\nRe-run with --keep to watch the video.\n'
