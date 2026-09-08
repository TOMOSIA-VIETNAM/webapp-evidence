#!/usr/bin/env bash
# Re-record the gif the README embeds. It records the same demo app the end-to-end check uses, so
# what a reader sees is the real runner's output rather than a mock-up made in a video editor.
#
#   docs/demo/record.sh
#
# Needs Google Chrome, ffmpeg and Node. Writes docs/demo/demo.gif and nothing else in the repository;
# the recording itself goes to a temporary directory.
set -euo pipefail

REPO="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
SKILL="$REPO/src/skills/recording"
GIF="$REPO/docs/demo/demo.gif"

# A README gif is read at a glance and downloaded by everyone who opens the page, so it is kept
# small on purpose: half the frame rate of the video, 900px wide, and a palette computed from the
# footage rather than the default 216-colour web palette, which bands the flat UI greys badly.
WIDTH=900
FPS=12
# The full viewport, not a crop of it: captions sit along the bottom edge the way subtitles do, and
# cropping the empty-looking lower band cuts them off.
CROP=1280:800:0:0

command -v ffmpeg >/dev/null || { printf 'record.sh: ffmpeg is required\n' >&2; exit 1; }
[ -d "$SKILL/scripts/node_modules" ] \
  || { printf 'record.sh: run npm install --prefix %s/scripts first\n' "$SKILL" >&2; exit 1; }

OUT_DIR="$(mktemp -d "${TMPDIR:-/tmp}/webapp-evidence-demo.XXXXXX")"
SERVER_PID=
cleanup() {
  [ -n "$SERVER_PID" ] && kill "$SERVER_PID" 2>/dev/null || true
  rm -rf -- "$OUT_DIR"
}
trap cleanup EXIT

node "$REPO/tests/e2e/serve.js" >"$OUT_DIR/.server" 2>&1 &
SERVER_PID=$!
for _ in $(seq 1 50); do [ -s "$OUT_DIR/.server" ] && break; sleep 0.1; done
BASE_URL="$(head -1 "$OUT_DIR/.server")"
case "$BASE_URL" in http://127.0.0.1:*) ;; *) printf 'record.sh: demo server did not start\n' >&2; exit 1 ;; esac

printf 'recording %s\n' "$BASE_URL"
BASE_URL="$BASE_URL" OUT_DIR="$OUT_DIR" CAPTIONS=on CAPTION_LOCALE=en \
  node "$SKILL/scripts/record.js" "$REPO/tests/e2e/demo-steps.js" >/dev/null

printf 'converting to %s\n' "$GIF"
mkdir -p -- "$(dirname -- "$GIF")"
PALETTE="$OUT_DIR/palette.png"
ffmpeg -v error -y -i "$OUT_DIR/demo.mp4" \
  -vf "fps=$FPS,crop=$CROP,scale=$WIDTH:-1:flags=lanczos,palettegen=stats_mode=diff" "$PALETTE"
ffmpeg -v error -y -i "$OUT_DIR/demo.mp4" -i "$PALETTE" \
  -lavfi "fps=$FPS,crop=$CROP,scale=$WIDTH:-1:flags=lanczos[v];[v][1:v]paletteuse=dither=bayer:bayer_scale=3" \
  "$GIF"

printf 'done — %s (%s)\n' "$GIF" "$(du -h "$GIF" | cut -f1)"
