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
BASE_URL="$BASE_URL" OUT_DIR="$OUT_DIR" SCREEN_CAPTURE=1 SCREEN_CAPTURE_NOTICE=off \
  EVIDENCE_CONFIG="$REPO/tests/e2e/window-capture.config.js" \
  node "$SKILL/scripts/record.js" "$REPO/tests/e2e/window-steps.js"

step "Checking what landed"
VIDEO="$OUT_DIR/e2e-window-capture.mp4"
[ -f "$VIDEO" ] || fail "no video at $VIDEO"

RUNBOOK="$OUT_DIR/e2e-window-capture-runbook.md"
[ -f "$RUNBOOK" ] || fail "no runbook at $RUNBOOK"

read -r W H <<EOF
$(ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=p=0 "$VIDEO" | tr ',' ' ')
EOF

# The runbook records the rectangle the runner cropped to and how many pixels there are to the
# point. Measuring the video against those is the only assertion that can tell the whole window
# from a piece of it: a crop of the top-left quarter fills the frame just as convincingly, and
# an earlier version of this check passed on exactly that.
read -r RW RH RSCALE <<EOF
$(sed -n 's/^capture_frame: \([0-9]*\)x\([0-9]*\) at [0-9]*,[0-9]*, \([0-9.]*\)x$/\1 \2 \3/p' "$RUNBOOK" | awk 'NR==1')
EOF
[ -n "$RSCALE" ] || fail "the runbook does not record what rectangle was captured"

EXPECT_W=$(awk -v w="$RW" -v s="$RSCALE" 'BEGIN { printf "%d", int(w * s / 2) * 2 }')
EXPECT_H=$(awk -v h="$RH" -v s="$RSCALE" 'BEGIN { printf "%d", int(h * s / 2) * 2 }')
[ "$W" = "$EXPECT_W" ] && [ "$H" = "$EXPECT_H" ] \
  || fail "the video is ${W}x${H}, but the window was ${RW}x${RH} at ${RSCALE}x, which is ${EXPECT_W}x${EXPECT_H}.
  The crop covered part of the window rather than all of it."

# The viewport in window-capture.config.js is 900x600, so a frame that is only the page would be
# 600 points tall. The window is taller by the height of the browser's own chrome — which is the
# entire claim this backend makes.
PAGE_H=$(awk -v s="$RSCALE" 'BEGIN { printf "%d", 600 * s }')
[ "$H" -gt "$PAGE_H" ] || fail "the frame is ${H}px tall, the same as the page, so the browser chrome is not in it"

# And the window really is what was recorded. Without Screen Recording permission macOS hands
# back a picture of the desktop, which is neither flat nor this green.
# The take ends holding on the page of one colour, so the last frame is inside that hold. Taking
# it that way needs no duration: reading one out of the container came back empty here, and a
# missing duration silently became a sample at 0.0s — the wrong end of the video, reported as
# though the crop were wrong.
BAND_Y=$(( H / 2 ))
GREEN="$(ffprobe -v error -f lavfi \
  -i "movie=${VIDEO},crop=400:80:250:${BAND_Y},signalstats" \
  -show_entries frame_tags=lavfi.signalstats.UAVG,lavfi.signalstats.VAVG -of csv=p=0 \
  | awk 'NF { last = $0 } END { print last }')"
[ -n "$GREEN" ] || fail "could not measure the middle of $VIDEO"

# #00b050 is strongly negative on both chroma axes; the desktop and the browser chrome are not.
awk -F, -v c="$GREEN" 'BEGIN { split(c, v, ","); exit (v[1] < 110 && v[2] < 110) ? 0 : 1 }' \
  || fail "the last frame does not show the demo page in the middle of the window (chroma $GREEN).
  Either the crop is in the wrong place, or Screen Recording permission is missing and macOS
  recorded the desktop instead. Grant it in System Settings > Privacy & Security > Screen
  Recording, for the application running this script, then run it again."

printf '\nPASSED\n'
printf '  video   %s (%sx%s)\n' "$VIDEO" "$W" "$H"
printf '  frame   the whole window: %sx%s points at %sx, and taller than the %s-point page\n' \
  "$RW" "$RH" "$RSCALE" 600
printf '  content the demo page fills the middle of the window (chroma %s)\n' "$GREEN"
[ "$KEEP" = yes ] || printf '\nRe-run with --keep to watch the video.\n'
