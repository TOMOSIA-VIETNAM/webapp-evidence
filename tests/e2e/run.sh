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

REPO="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
SKILL="$REPO/src/skills/get"
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
for phrase in 'Run the search' 'Open a row' 'Select all' 'demo fixture' 'BASE_URL'; do
  grep -qF -- "$phrase" "$RUNBOOK" || fail "the runbook never mentions '$phrase'"
done
grep -qE '^[0-9]{2}:[0-9]{2} - [0-9]{2}:[0-9]{2}' "$RUNBOOK" \
  || fail "the runbook has no timeline rows"

# A console log is written only when the page misbehaved. The demo app is meant to be quiet.
[ -f "$OUT_DIR/$NAME-console.log" ] \
  && fail "the demo app reported page errors: $(cat "$OUT_DIR/$NAME-console.log")"

printf '\nPASSED\n'
printf '  video     %s (%s bytes, %.1fs)\n' "$VIDEO" "$SIZE" "$DURATION"
printf '  runbook   %s\n' "$RUNBOOK"
printf '  screenshots %s\n' "$SHOTS"
[ "$KEEP" = yes ] || printf '\nRe-run with --keep to watch the video.\n'
