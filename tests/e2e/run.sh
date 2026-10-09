#!/usr/bin/env bash
# End-to-end check: serve the demo app, record it with the real runner in a real browser, and assert
# on what lands on disk. The unit tests cover the decisions; this covers the one thing they cannot —
# that a recording actually happens and produces a video, screenshots and a runbook — and that
# edit.js renders edits of that take without touching it.
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

fail_missing_tool() {
  printf '\nFAILED: %s is not on PATH\n' "$1" >&2
  printf '  If `%s -v` works in your shell but not here, a version manager is loading it lazily\n' "$1" >&2
  printf '  (nvm does this) — it is a shell function, not a binary, so a script cannot see it.\n' >&2
  printf '  Run with the real directory on PATH, e.g. PATH="$HOME/.nvm/versions/node/<version>/bin:$PATH"\n' >&2
  exit 1
}
step() { printf '\n== %s\n' "$1"; }

for tool in node ffmpeg; do
  command -v "$tool" >/dev/null || fail_missing_tool "$tool"
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

# The session the demo app hands the browser. The take calls an endpoint with it from the terminal
# panel, and the checks below prove it got there without the value appearing anywhere in the
# evidence — which is the whole reason the cookies travel as a file.
export DEMO_SESSION=demo-session-8f3c1d9a2b

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
              'Reach the audit trail below the fold' \
              'Commands run in the terminal' 'tail -f' 'wc -l' 'SyncJob' \
              'curl -sS' '/report' 'Call the export endpoint'; do
  grep -qF -- "$phrase" "$RUNBOOK" || fail "the runbook never mentions '$phrase'"
done
grep -qE '^[0-9]{2}:[0-9]{2} - [0-9]{2}:[0-9]{2}' "$RUNBOOK" \
  || fail "the runbook has no timeline rows"

# The request in the panel was made with the session the browser holds, and the runbook quotes
# every command that ran. The session must be in none of it: handed to curl along the command line
# it would be in the video for as long as the command was on screen, and in this file underneath.
#
# The status is not checked here — `expect: 200` in the step script is the assertion, and a take
# that got anything else never reached the point of writing a runbook.
step "Checking the session stayed out of the evidence"
grep -q "$DEMO_SESSION" "$RUNBOOK" && fail "the session cookie is written out in $RUNBOOK"
grep -q -- '-b /' "$RUNBOOK" || fail "the request did not send the session as a cookie file"
[ -n "$(find "$OUT_DIR" -maxdepth 1 -name '*-api-response.png' | awk 'NR==1')" ] \
  || fail "no screenshot was taken while the response was on screen"

# The runbook can carry the command section while the panel never actually drew: the value of the
# terminal is that a reviewer SEES the log. The panel is dark and the demo app behind it is not, so
# the average brightness along the bottom of the frame says whether it rendered.
#
# The band is narrow on purpose. The panel is sized to the command it is showing, and this
# screenshot is taken on one that has printed two lines, so the panel is near its smallest — a band
# as tall as the ceiling would be mostly page, and would read as bright however well the panel drew.
PANEL_BAND=90
PANEL_SHOT="$(find "$OUT_DIR" -maxdepth 1 -name '*-worker-finished.png' | awk 'NR==1')"
[ -n "$PANEL_SHOT" ] || fail "no screenshot was taken while the terminal panel was open"
PANEL_LUMA="$(ffprobe -v error -f lavfi \
  -i "movie=${PANEL_SHOT},crop=iw:${PANEL_BAND}:0:ih-${PANEL_BAND},signalstats" \
  -show_entries frame_tags=lavfi.signalstats.YAVG -of csv=p=0)"
awk -v y="$PANEL_LUMA" 'BEGIN { exit (y < 70) ? 0 : 1 }' \
  || fail "the bottom of $PANEL_SHOT has brightness $PANEL_LUMA, so the terminal panel did not draw"

# A console log is written only when the page misbehaved. The demo app is meant to be quiet.
[ -f "$OUT_DIR/$NAME-console.log" ] \
  && fail "the demo app reported page errors: $(cat "$OUT_DIR/$NAME-console.log")"

# Edits after the take: one of each kind, on the video and on a screenshot. Every one of them is
# rendered from the recording, so the recording has to come out of it exactly as it went in.
step "Editing the take"
EDIT="$SKILL/scripts/edit.js"
TIMELINE="$OUT_DIR/$NAME-timeline.json"
EDITED="$OUT_DIR/$NAME-edited.mp4"
EDITED_RUNBOOK="$OUT_DIR/$NAME-edited-runbook.md"
EDITED_TIMELINE="$OUT_DIR/$NAME-edited-timeline.json"
EDIT_LOG="$OUT_DIR/.edits"
KEY_SHOT="$(find "$OUT_DIR" -maxdepth 1 -name '*-key-revealed.png' | awk 'NR==1')"
[ -n "$KEY_SHOT" ] || fail "no screenshot was taken while the key was on screen"
ORIGINALS="$OUT_DIR/.originals"
# shellcheck disable=SC2046  # file names this runner writes hold no spaces
shasum -a 256 "$VIDEO" "$RUNBOOK" "$TIMELINE" \
  $(find "$OUT_DIR" -maxdepth 1 -name '[0-9][0-9]-*.png' ! -name '*-edited.png') >"$ORIGINALS"

edit() {
  node "$EDIT" "$@" >>"$EDIT_LOG" 2>&1 || fail "edit.js $* failed: $(tail -5 "$EDIT_LOG")"
}
edit "$VIDEO" highlight --step 'Run the search'
edit "$VIDEO" arrow --step 'Trigger the sync, whose work happens on the server'
edit "$VIDEO" cover --step 'Reveal the API key'
edit "$VIDEO" cut --step 'Travel to a section that holds nothing to click'
edit "$VIDEO" speed 2 --step 'Read the worker log to prove the job ran'
edit "$VIDEO" trim --start 0.5
edit "$VIDEO" still 3
edit "$KEY_SHOT" highlight --step

for file in "$EDITED" "$EDITED_RUNBOOK" "$EDITED_TIMELINE" "${KEY_SHOT%.png}-edited.png"; do
  [ -f "$file" ] || fail "edit.js left no $file"
done
[ -n "$(find "$OUT_DIR" -maxdepth 1 -name '[0-9][0-9]-still-*.png' | awk 'NR==1')" ] \
  || fail "still wrote no screenshot of the edited video"
shasum -a 256 -c --quiet "$ORIGINALS" >/dev/null 2>&1 \
  || fail "editing changed a file of the recording: $(shasum -a 256 -c "$ORIGINALS" 2>&1 | grep -v ': OK$')"

# What the edit model predicts, and where on the edited files to look. The model is the one the
# render is built from, so a render that drifts from it is caught here rather than by a viewer.
PREDICTED="$(node -e '
  const [skill, timeline, recorded, shot] = process.argv.slice(1);
  const fs = require("fs");
  const read = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
  const { editedVideo, load, editsFile } = require(`${skill}/scripts/edits`);
  const { scaled, TRANSITION } = require(`${skill}/scripts/style`);
  const { pngSize } = require(`${skill}/scripts/overlay`);
  const take = read(timeline);
  const video = editedVideo(take, load(editsFile(recorded)));
  const last = take.marks.at(-1);
  // The top edge of the highlight, half way along: the accent stroke is centred on it.
  const [mark] = load(editsFile(shot));
  const s = scaled(pngSize(shot).width);
  const ring = { x: Math.round(mark.box.x + mark.box.width / 2), y: Math.round(Math.max(s.haloWidth / 2, mark.box.y - s.padding)) };
  const [fade] = video.fades;
  console.log([
    video.duration, Math.floor(video.toEdited(last.at)), ring.x, ring.y,
    fade.from, fade.to, TRANSITION.fadeOut, JSON.stringify(video.fades), last.label,
  ].join(" "));
' "$SKILL" "$TIMELINE" "$VIDEO" "$KEY_SHOT")" || fail "the edit model could not read the take"
# The label goes last, so `read` hands it over whole, spaces and all
read -r PREDICTED_DURATION PREDICTED_LAST RING_X RING_Y FADE_FROM FADE_TO FADE_OUT PREDICTED_FADES LAST_LABEL <<<"$PREDICTED"

# The edited video is as long as the model says, to within one frame
EDITED_DURATION=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$EDITED")
FPS=$(ffprobe -v error -select_streams v:0 -show_entries stream=r_frame_rate -of csv=p=0 "$EDITED")
awk -v d="$EDITED_DURATION" -v p="$PREDICTED_DURATION" -v r="$FPS" \
  'BEGIN { split(r, f, "/"); exit (d - p <= f[2] / f[1] && p - d <= f[2] / f[1]) ? 0 : 1 }' \
  || fail "the edited video is ${EDITED_DURATION}s where the edits predict ${PREDICTED_DURATION}s"

# The last step starts earlier once a stretch is cut and another sped up, and the edited runbook
# says where it is now
row_start() {
  awk -v label="$2" 'index($0, "  " label) && /^[0-9][0-9]:[0-9][0-9] - / {
    split($1, t, ":"); print t[1] * 60 + t[2]; exit }' "$1"
}
WAS_AT="$(row_start "$RUNBOOK" "$LAST_LABEL")"
NOW_AT="$(row_start "$EDITED_RUNBOOK" "$LAST_LABEL")"
[ -n "$WAS_AT" ] && [ -n "$NOW_AT" ] || fail "a runbook has no row for \"$LAST_LABEL\""
[ "$NOW_AT" -lt "$WAS_AT" ] || fail "the edited runbook still puts \"$LAST_LABEL\" at ${NOW_AT}s, as the recording has it"
[ "$NOW_AT" -eq "$PREDICTED_LAST" ] \
  || fail "the edited runbook puts \"$LAST_LABEL\" at ${NOW_AT}s where the edits put it at ${PREDICTED_LAST}s"

# The highlight on the edited screenshot is drawn in the accent, C66A42
RING_RGB="$(ffmpeg -v error -i "${KEY_SHOT%.png}-edited.png" -vf "crop=1:1:${RING_X}:${RING_Y}" \
  -f rawvideo -pix_fmt rgb24 - | od -An -tu1 | tr -s ' ' | sed 's/^ //')"
awk -v c="$RING_RGB" 'BEGIN { split(c, v, " "); d = 0
    d += (v[1] > 198 ? v[1] - 198 : 198 - v[1]); d += (v[2] > 106 ? v[2] - 106 : 106 - v[2]); d += (v[3] > 66 ? v[3] - 66 : 66 - v[3])
    exit (d <= 24) ? 0 : 1 }' \
  || fail "the highlight on the edited screenshot is ($RING_RGB) at ${RING_X},${RING_Y}, not the accent (198 106 66)"

# The join the cut left dissolves through a darkened frame, between the held frame on each side
luma_at() {
  ffprobe -v error -f lavfi -i "movie=${EDITED},select='gte(t\,$1)',signalstats" \
    -show_entries frame_tags=lavfi.signalstats.YAVG -of csv=p=0 | awk 'NR==1'
}
[ "$(node -e 'console.log(JSON.stringify(JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")).fades))' "$EDITED_TIMELINE")" = "$PREDICTED_FADES" ] \
  || fail "the edited timeline's fades are not where the edits put the join"
JOIN_AT=$(awk -v f="$FADE_FROM" -v o="$FADE_OUT" 'BEGIN { print f + o }')
BEFORE_LUMA="$(luma_at "$(awk -v f="$FADE_FROM" 'BEGIN { print f - 0.2 }')")"
JOIN_LUMA="$(luma_at "$JOIN_AT")"
AFTER_LUMA="$(luma_at "$(awk -v t="$FADE_TO" 'BEGIN { print t + 0.2 }')")"
awk -v b="$BEFORE_LUMA" -v j="$JOIN_LUMA" -v a="$AFTER_LUMA" \
  'BEGIN { exit (j < 0.8 * b && j < 0.8 * a) ? 0 : 1 }' \
  || fail "the join at ${JOIN_AT}s has brightness $JOIN_LUMA, not darker than $BEFORE_LUMA before it and $AFTER_LUMA after"

# A contact sheet of the edited video samples the held frame where the dissolve plays: one tile per
# sheet and one sheet every twentieth of a second, through the sheet's own filter and fades
SHEET_LUMA="$(node -e '
  const [vision, video] = process.argv.slice(1);
  const { execFileSync } = require("child_process");
  const { buildFilter, fadesOf } = require(`${vision}/scripts/contact-sheet`);
  const fades = fadesOf(video);
  if (!fades.length) throw new Error("the contact sheet finds no fades beside the edited video");
  const filter = buildFilter({ every: 0.05, columns: 1, rows: 1, tile: 320 }, null, fades);
  const tiles = [];
  for (const line of execFileSync("ffmpeg", ["-v", "error", "-i", video, "-vf",
    `${filter},signalstats,metadata=print:key=lavfi.signalstats.YAVG:file=-`, "-f", "null", "-"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).split("\n")) {
    const at = line.match(/pts_time:([\d.]+)/);
    if (at) tiles.push({ at: Number(at[1]) });
    const y = line.match(/YAVG=([\d.]+)/);
    if (y) tiles.at(-1).y = Number(y[1]);
  }
  const [{ from, to }] = fades;
  const before = tiles.filter((t) => t.at < from).at(-1);
  const inside = tiles.filter((t) => t.at >= from && t.at <= to);
  console.log(before.y, Math.min(...inside.map((t) => t.y)), inside.length);
' "$REPO/src/skills/vision" "$EDITED")" || fail "the contact sheet of the edited video could not be sampled"
read -r SHEET_BEFORE SHEET_INSIDE SHEET_TILES <<<"$SHEET_LUMA"
[ "${SHEET_TILES:-0}" -gt 0 ] || fail "no tile of the contact sheet lands on the dissolve"
awk -v b="$SHEET_BEFORE" -v i="$SHEET_INSIDE" 'BEGIN { exit (i > b - 3) ? 0 : 1 }' \
  || fail "a contact sheet tile on the dissolve has brightness $SHEET_INSIDE, darker than the held frame's $SHEET_BEFORE"

# What a step script gets back when it asks what is on a screen. The selector has to match on the
# text in the markup: the export button is uppercased by CSS, and a name read off the screen
# resolves against nothing while looking exactly like a name that would.
step "Checking the probe prints selectors that resolve"
PROBE="$OUT_DIR/.inspect"
BASE_URL="$BASE_URL" node "$SKILL/scripts/inspect.js" / >"$PROBE" 2>&1 \
  || fail "inspect.js exited non-zero: $(cat "$PROBE")"
grep -qF 'name: "Export report"' "$PROBE" \
  || fail "the probe did not print the button's name as the DOM holds it: $(grep -i export "$PROBE")"
# And a name carrying an apostrophe comes out as a string a step script can be pasted with.
grep -qF 'name: "Don'"'"'t save"' "$PROBE" \
  || fail "the probe did not escape an apostrophe in a name: $(grep -i save "$PROBE")"
grep -qF 'on screen: EXPORT REPORT' "$PROBE" \
  || fail "the probe never says the screen shows something else"

# A take that fails. The recording stops where the flow did, what was recorded is handed over as a
# video rather than as the backend's own file under a name nobody can place, and the error says
# which step it died in — none of which the passing take above can show.
step "Checking a take that fails stops where it failed"
FAIL_OUT="$OUT_DIR/failed"
FAIL_LOG="$OUT_DIR/.failed"
mkdir -p "$FAIL_OUT"
set +e
BASE_URL="$BASE_URL" OUT_DIR="$FAIL_OUT" CAPTIONS=off \
  node "$SKILL/scripts/record.js" "$REPO/tests/e2e/failing-steps.js" >"$FAIL_LOG" 2>&1
FAIL_STATUS=$?
set -e
[ "$FAIL_STATUS" -ne 0 ] || fail "a step script that threw still reported success"
grep -qF 'Search, and then stop on purpose' "$FAIL_LOG" \
  || fail "the failure never names the step it happened in: $(cat "$FAIL_LOG")"
grep -qF 'stopped here on purpose' "$FAIL_LOG" \
  || fail "the failure lost what the step script actually said: $(cat "$FAIL_LOG")"
[ -z "$(find "$FAIL_OUT" -maxdepth 1 -name '*.webm' | awk 'NR==1')" ] \
  || fail "the raw capture was left behind in $FAIL_OUT"
PARTIAL="$(find "$FAIL_OUT" -maxdepth 1 -name '*-failed.mp4' | awk 'NR==1')"
[ -n "$PARTIAL" ] || fail "nothing was kept of what the failed take did record"
PARTIAL_DURATION=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$PARTIAL")
# It holds the flow up to the failure and nothing after it: the failure is what stops the recorder,
# so a file much longer than the take itself means it went on recording without one.
awk -v d="$PARTIAL_DURATION" 'BEGIN { exit (d < 30) ? 0 : 1 }' \
  || fail "the failed take left ${PARTIAL_DURATION}s of video, so the recorder outlived the take"

printf '\nPASSED\n'
printf '  video     %s (%s bytes, %.1fs)\n' "$VIDEO" "$SIZE" "$DURATION"
printf '  runbook   %s\n' "$RUNBOOK"
printf '  screenshots %s\n' "$SHOTS"
printf '  panel     drawn (brightness %s over the bottom %spx)\n' "$PANEL_LUMA" "$PANEL_BAND"
printf '  endpoint  answered 200, session kept out of the runbook\n'
printf '  edited    %ss (predicted %ss), join brightness %s between %s and %s\n' \
  "$EDITED_DURATION" "$PREDICTED_DURATION" "$JOIN_LUMA" "$BEFORE_LUMA" "$AFTER_LUMA"
[ "$KEEP" = yes ] || printf '\nRe-run with --keep to watch the video.\n'
