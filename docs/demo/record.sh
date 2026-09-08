#!/usr/bin/env bash
# Re-record the gif in the README, and print the runbook that came with it.
#
#   docs/demo/record.sh
#
# It records saucedemo.com — a site published to be automated — through this repository's own
# runner, so a reader sees real output rather than a mock-up. Needs Google Chrome, ffmpeg and Node,
# and about a minute.
#
# The recording goes to a temporary directory; only docs/demo/saucedemo.gif lands in the repository.
# The runbook is printed at the end because the README quotes from it, and quoting something you
# have not just regenerated is how a README drifts away from the thing it describes.
set -euo pipefail

REPO="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
SKILL="$REPO/src/skills/recording"
GIF="$REPO/docs/demo/saucedemo.gif"
BASE_URL=https://www.saucedemo.com

# A README gif is downloaded by everyone who opens the page, so the frame rate is cut to a quarter
# of the video's. The width is not cut the same way: the README displays it at 820px, and a gif
# narrower than that gets scaled UP by the browser, which is what made the first one look soft. Wider
# than the display size means the browser scales down instead, and the text stays sharp.
#
# No dithering either. Dither exists to fake missing colours in photographs; on flat UI greys and
# small text it just sprays noise over the letters. A palette built from the footage covers this kind
# of screen with far fewer colours than a photo would need.
FPS=8
WIDTH=1024
COLORS=128

command -v ffmpeg >/dev/null || { printf 'record.sh: ffmpeg is required\n' >&2; exit 1; }
[ -d "$SKILL/scripts/node_modules" ] \
  || { printf 'record.sh: run npm install --prefix %s/scripts first\n' "$SKILL" >&2; exit 1; }

OUT_DIR="$(mktemp -d "${TMPDIR:-/tmp}/webapp-evidence-demo.XXXXXX")"
trap 'rm -rf -- "$OUT_DIR"' EXIT

printf 'recording %s\n' "$BASE_URL"
BASE_URL="$BASE_URL" OUT_DIR="$OUT_DIR" CAPTIONS=on CAPTION_LOCALE=en \
  node "$SKILL/scripts/record.js" "$REPO/docs/demo/saucedemo-steps.js" >/dev/null

printf 'converting to %s\n' "$GIF"
mkdir -p -- "$(dirname -- "$GIF")"
PALETTE="$OUT_DIR/palette.png"
ffmpeg -v error -y -i "$OUT_DIR/saucedemo-checkout.mp4" \
  -vf "fps=$FPS,scale=$WIDTH:-1:flags=lanczos,palettegen=stats_mode=diff:max_colors=$COLORS" "$PALETTE"
ffmpeg -v error -y -i "$OUT_DIR/saucedemo-checkout.mp4" -i "$PALETTE" \
  -lavfi "fps=$FPS,scale=$WIDTH:-1:flags=lanczos[v];[v][1:v]paletteuse=dither=none" \
  "$GIF"

printf 'done — %s (%s)\n\n' "$GIF" "$(du -h "$GIF" | cut -f1)"
printf -- '---- the runbook this take produced ----\n\n'
cat "$OUT_DIR/saucedemo-checkout-runbook.md"
