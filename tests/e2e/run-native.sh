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
[ -f "$VIDEO" ] || fail "no video at $VIDEO"

# One sheet of frames across the whole take, so what did and did not reach the video can be seen
# at a glance rather than by scrubbing.
step "Building a contact sheet"
DURATION=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$VIDEO")
SHEET="$OUT_DIR/frames.png"
ffmpeg -v error -i "$VIDEO" \
  -vf "fps=1,scale=420:-1,tile=4x4:margin=6:padding=4:color=0x222222" \
  -frames:v 1 -y "$SHEET"

printf '\nRECORDED\n'
printf '  video   %s (%.1fs)\n' "$VIDEO" "$DURATION"
printf '  frames  %s\n' "$SHEET"
printf '  shots   %s\n' "$(find "$OUT_DIR" -maxdepth 1 -name '*.png' | wc -l | tr -d ' ')"
printf '  runbook %s\n' "$OUT_DIR/e2e-native-ui-runbook.md"
