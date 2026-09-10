#!/usr/bin/env bash
# Records the demo app with the window capture backend and checks the frame is the browser
# window. Separate from run.sh because this one cannot run headless, cannot run in CI, and
# records what is on a screen — it needs a person to agree and to leave the machine alone.
#
#   tests/e2e/run-window.sh          record, check, delete the output
#   tests/e2e/run-window.sh --keep   leave the output so you can watch it
#
# Needs Google Chrome, ffmpeg, Node, a display, and Screen Recording permission for whichever
# application runs this. Takes about half a minute, during which the machine should be left alone.
set -euo pipefail

REPO="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
SKILL="$REPO/src/skills/recording"
KEEP=no
[ "${1:-}" = "--keep" ] && KEEP=yes

fail() { printf '\nFAILED: %s\n' "$1" >&2; exit 1; }
step() { printf '\n== %s\n' "$1"; }

for tool in node ffmpeg ffprobe; do
  command -v "$tool" >/dev/null || fail "$tool is not on PATH"
done
[ -d "$SKILL/scripts/node_modules" ] \
  || fail "runner dependency missing — run: npm install --prefix $SKILL/scripts"

OUT_DIR="$(mktemp -d "${TMPDIR:-/tmp}/webapp-evidence-window.XXXXXX")"
SERVER_PID=
cleanup() {
  [ -n "$SERVER_PID" ] && kill "$SERVER_PID" 2>/dev/null || true
  if [ "$KEEP" = yes ]; then printf '\nOutput kept in %s\n' "$OUT_DIR"; else rm -rf -- "$OUT_DIR"; fi
}
trap cleanup EXIT

step "Serving the demo app"
SERVER_OUT="$OUT_DIR/.server"
node "$REPO/tests/e2e/serve.js" >"$SERVER_OUT" 2>&1 &
SERVER_PID=$!
for _ in $(seq 1 50); do [ -s "$SERVER_OUT" ] && break; sleep 0.1; done
BASE_URL="$(awk 'NR==1' "$SERVER_OUT")"
case "$BASE_URL" in http://127.0.0.1:*) ;; *) fail "the demo server did not start: $(cat "$SERVER_OUT")" ;; esac
printf '%s\n' "$BASE_URL"

step "Recording the browser window — please leave the machine alone"
BASE_URL="$BASE_URL" OUT_DIR="$OUT_DIR" SCREEN_CAPTURE=1 \
  EVIDENCE_CONFIG="$REPO/tests/e2e/window-capture.config.js" \
  node "$SKILL/scripts/record.js" "$REPO/tests/e2e/window-steps.js"

step "Checking what landed"
VIDEO="$OUT_DIR/e2e-window-capture.mp4"
[ -f "$VIDEO" ] || fail "no video at $VIDEO"

read -r W H <<EOF
$(ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=p=0 "$VIDEO" | tr ',' ' ')
EOF

# The viewport in window-capture.config.js is 900x600. A window capture is the whole window, so
# it is taller than the page by the height of the browser's own chrome — which is the entire
# claim this backend makes.
[ "$W" = 900 ] || fail "the frame is ${W}px wide, not the 900px of the window (was the display scale applied?)"
[ "$H" -gt 640 ] || fail "the frame is ${H}px tall, so it is the page (600px) and not the window"

# And the window really is what was recorded. Without Screen Recording permission macOS hands
# back a picture of the desktop, which is neither flat nor this green.
DURATION=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$VIDEO")
SAMPLE_T=$(awk -v d="$DURATION" 'BEGIN { printf "%.1f", (d > 2) ? d - 1.2 : d / 2 }')
BAND_Y=$(( H / 2 ))
GREEN="$(ffprobe -v error -f lavfi \
  -i "movie=${VIDEO},select='gte(t\,${SAMPLE_T})',crop=400:80:250:${BAND_Y},signalstats" \
  -show_entries frame_tags=lavfi.signalstats.UAVG,lavfi.signalstats.VAVG -of csv=p=0 | awk 'NR==1')"
# #00b050 is strongly negative on both chroma axes; the desktop and the browser chrome are not.
awk -F, -v c="$GREEN" 'BEGIN { split(c, v, ","); exit (v[1] < 110 && v[2] < 110) ? 0 : 1 }' \
  || fail "at ${SAMPLE_T}s the middle of the frame is not the demo page (chroma $GREEN).
  Either the crop is in the wrong place, or Screen Recording permission is missing and macOS
  recorded the desktop instead. Grant it in System Settings > Privacy & Security > Screen
  Recording, for the application running this script, then run it again."

printf '\nPASSED\n'
printf '  video   %s (%sx%s, %.1fs)\n' "$VIDEO" "$W" "$H" "$DURATION"
printf '  frame   the browser window: %spx taller than the %spx page\n' "$(( H - 600 ))" 600
printf '  content the demo page is in the frame (chroma %s)\n' "$GREEN"
[ "$KEEP" = yes ] || printf '\nRe-run with --keep to watch the video.\n'
