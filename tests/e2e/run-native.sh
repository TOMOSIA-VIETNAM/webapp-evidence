#!/usr/bin/env bash
# Records the three things a page recording can never contain — the dropdown a <select> opens,
# the browser's own dialogs, and DevTools — with the window capture backend, and leaves the
# result behind to be looked at.
#
#   tests/e2e/run-native.sh              without DevTools
#   tests/e2e/run-native.sh --devtools   with DevTools opened alongside the page
#
# Needs a display, Screen Recording permission, and the machine left alone for about half a
# minute. The output is always kept: what this produces is meant to be watched.
set -euo pipefail

REPO="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
SKILL="$REPO/src/skills/recording"
DEVTOOLS=0
[ "${1:-}" = "--devtools" ] && DEVTOOLS=1

fail() { printf '\nFAILED: %s\n' "$1" >&2; exit 1; }
step() { printf '\n== %s\n' "$1"; }

for tool in node ffmpeg ffprobe; do command -v "$tool" >/dev/null || fail "$tool is not on PATH"; done

OUT_DIR="$(mktemp -d "${TMPDIR:-/tmp}/webapp-evidence-native.XXXXXX")"
SERVER_PID=
cleanup() { [ -n "$SERVER_PID" ] && kill "$SERVER_PID" 2>/dev/null || true; }
trap cleanup EXIT

step "Serving the demo app"
SERVER_OUT="$OUT_DIR/.server"
node "$REPO/tests/e2e/serve.js" >"$SERVER_OUT" 2>&1 &
SERVER_PID=$!
for _ in $(seq 1 50); do [ -s "$SERVER_OUT" ] && break; sleep 0.1; done
BASE_URL="$(awk 'NR==1' "$SERVER_OUT")"
case "$BASE_URL" in http://127.0.0.1:*) ;; *) fail "the demo server did not start: $(cat "$SERVER_OUT")" ;; esac
printf '%s\n' "$BASE_URL"

step "Recording — please leave the machine alone"
BASE_URL="$BASE_URL" OUT_DIR="$OUT_DIR" SCREEN_CAPTURE=1 DEVTOOLS="$DEVTOOLS" \
  EVIDENCE_CONFIG="$REPO/tests/e2e/native-capture.config.js" \
  node "$SKILL/scripts/record.js" "$REPO/tests/e2e/native-steps.js"

VIDEO="$OUT_DIR/e2e-native-ui.mp4"
RUNBOOK="$OUT_DIR/e2e-native-ui-runbook.md"
[ -f "$VIDEO" ] || fail "no video at $VIDEO"
[ -f "$RUNBOOK" ] || fail "no runbook at $RUNBOOK"

# Mean brightness of a rectangle at one moment of the video. ffprobe cannot seek a `movie=`
# input, so the frame is chosen inside the filter graph.
luma_at() {
  ffprobe -v error -f lavfi \
    -i "movie=${VIDEO},select='gte(t\,$1)',crop=$2,signalstats" \
    -show_entries frame_tags=lavfi.signalstats.YAVG -of csv=p=0 | awk 'NR==1'
}

# How much a rectangle changed between two moments: the two frames laid over each other in
# difference mode, averaged. Near zero means nothing there moved.
changed_between() {
  ffmpeg -v error -ss "$1" -i "$VIDEO" -frames:v 1 -y "$OUT_DIR/.a.png"
  ffmpeg -v error -ss "$2" -i "$VIDEO" -frames:v 1 -y "$OUT_DIR/.b.png"
  ffprobe -v error -f lavfi \
    -i "movie=$OUT_DIR/.a.png,crop=$3[a];movie=$OUT_DIR/.b.png,crop=$3[b];[a][b]blend=all_mode=difference,signalstats" \
    -show_entries frame_tags=lavfi.signalstats.YAVG -of csv=p=0 | awk 'NR==1'
}

read -r FW FH FSCALE <<EOF
$(sed -n 's/^capture_frame: \([0-9]*\)x\([0-9]*\) at [0-9]*,[0-9]*, \([0-9.]*\)x$/\1 \2 \3/p' "$RUNBOOK" | awk 'NR==1')
EOF
[ -n "$FSCALE" ] || fail "the runbook does not record what rectangle was captured"
px() { awk -v v="$1" -v s="$FSCALE" 'BEGIN { printf "%d", int(v * s / 2) * 2 }'; }

# The viewport the configuration asks for. Everything else about the frame is measured, but this
# is the one number the runner was told rather than found, so it is read from the same file.
VIEWPORT_H=$(node -e 'process.env.BASE_URL="http://x";
  console.log(require(process.argv[1]).recording.viewport.height)' \
  "$REPO/tests/e2e/native-capture.config.js")

step "Checking the dropdown a <select> opens"
# macOS draws that menu itself, in a window of its own, so no recording of page content can hold
# it. Whether a synthetic click even opens one is the question: if it does not, the page looks
# the same before and after.
#
# The area is the page below the browser's chrome, worked out from the rectangle the runner
# recorded rather than from this machine's numbers, and the moment is found by trying several
# rather than assuming a pace. The cursor moving accounts for a fraction of a percent over an
# area this size; a menu accounts for a great deal more.
PAGE_CHROME=$(( FH - VIEWPORT_H ))
PAGE_AREA="$(px "$FW"):$(px $(( FH - PAGE_CHROME ))):0:$(px "$PAGE_CHROME")"
MENU_CHANGE=0
MENU_AT=
for t in 1.0 1.5 2.0 2.5 3.0 3.5; do
  d="$(changed_between 0.3 "$t" "$PAGE_AREA")"
  [ -n "$d" ] || continue
  if awk -v a="$d" -v b="$MENU_CHANGE" 'BEGIN { exit (a > b) ? 0 : 1 }'; then
    MENU_CHANGE="$d"
    MENU_AT="$t"
  fi
done
awk -v c="$MENU_CHANGE" 'BEGIN { exit (c > 4) ? 0 : 1 }' \
  || fail "nothing ever opened over the page after the Status field was clicked (largest difference $MENU_CHANGE).
  Either a synthetic click does not open the native menu on this machine, or the menu fell
  outside the crop."

step "Checking the dialogs the browser puts up"
for expected in 'confirm: "Delete 3 selected users? This cannot be undone." — accepted' \
                'confirm: "Delete 3 selected users? This cannot be undone." — dismissed' \
                'alert: "A notice was sent to 3 users." — accepted'; do
  grep -qF -- "$expected" "$RUNBOOK" || fail "the runbook does not record: $expected"
done

# Chrome draws its dialog over the top of the page, where this app has a dark header. A band
# across the middle of it goes from dark to almost white when the dialog is up. Sized from the
# recorded rectangle, so the check does not depend on the display it ran on.
DIALOG_BAND="$(px $(( FW / 2 ))):$(px 60):$(px $(( FW / 4 ))):$(px $(( PAGE_CHROME + 10 )))"
read -r DM DS <<EOF
$(sed -n 's/^- \([0-9]*\):\([0-9]*\)  confirm:.*accepted$/\1 \2/p' "$RUNBOOK" | awk 'NR==1')
EOF
[ -n "$DS" ] || fail "the runbook does not timestamp the confirm that was accepted"
DIALOG_T=$(( 10#$DM * 60 + 10#$DS ))
BEFORE_T=$(awk -v t="$DIALOG_T" 'BEGIN { printf "%.1f", (t > 2) ? t - 2 : 0 }')

DURING="$(luma_at "$DIALOG_T" "$DIALOG_BAND")"
BEFORE="$(luma_at "$BEFORE_T" "$DIALOG_BAND")"
[ -n "$DURING" ] && [ -n "$BEFORE" ] || fail "could not measure the top of the frame"
awk -v d="$DURING" -v b="$BEFORE" 'BEGIN { exit (d - b > 40) ? 0 : 1 }' \
  || fail "at ${DIALOG_T}s the top of the frame is no brighter than at ${BEFORE_T}s ($DURING vs $BEFORE),
  so the browser's dialog is not in the video."

rm -f "$OUT_DIR/.a.png" "$OUT_DIR/.b.png"

printf '\nPASSED\n'
printf '  video     %s\n' "$VIDEO"
printf '  frame     the whole window: %sx%s points at %sx\n' "$FW" "$FH" "$FSCALE"
printf '  dropdown  the native menu opened over the page at %ss (difference %s)\n' "$MENU_AT" "$MENU_CHANGE"
printf '  dialogs   three recorded, and the frame brightens for them (%s vs %s)\n' "$DURING" "$BEFORE"
[ "$DEVTOOLS" = 1 ] && printf '  devtools  opened alongside the page\n'
printf '\nOutput kept in %s\n' "$OUT_DIR"
