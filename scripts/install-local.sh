#!/usr/bin/env bash
# Install get-evidence into a platform that reads it straight off disk. Use when a platform's catalog is
# not an option — a submission still pending, or an import gated by plan or role.
#
# A vendor's IDE and CLI rarely read the same directory, so a vendor name covers both of theirs; the
# narrower ids exist for anyone who wants one. Links back into this clone by default, so `git pull`
# here updates every platform at once; --copy detaches them.
set -euo pipefail
# Piping this into `head` closes stdout early. Progress messages must not be able to abort an
# install part way through, so every one of them tolerates a dead pipe.
trap '' PIPE
say() { printf "$@" 2>/dev/null || true; }

REPO="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
MARKER='<!-- installed by get-evidence scripts/install-local.sh — safe to delete -->'
STAMP=".get-evidence-local-install"
MARKETPLACE='TOMOSIA-VIETNAM/webapp-evidence'

usage() {
  cat <<'EOF'
Usage: scripts/install-local.sh [--platform NAME] [--target DIR] [--copy]
                                [--update | --uninstall [--all]]

  --platform NAME  repeatable, or comma-separated. `all` means every platform below.
                   claude           marketplace  ~/.claude/plugins
                   shared           skills       ~/.agents/skills
                   cursor-ide       plugin       ~/.cursor/plugins/local/get-evidence
                   cursor-cli       skills       ~/.cursor/skills
                   antigravity-cli  skills       ~/.gemini/antigravity-cli/skills
                   antigravity-ide  skills       ~/.gemini/config/skills
                   Omit it and the script asks.
  --target DIR     install somewhere else; one platform at a time
  --copy           copy instead of linking (if your platform will not follow symlinks)
  --update         git pull in this clone, then reinstall
  --uninstall      remove only what this script installed
  --all            with --uninstall: sweep every platform above

Skill installed: get-evidence (SKILL.md, references, templates and the Node runner)
Never overwrites a file this script did not create.
EOF
}

platform_members() {
  case "$1" in
    all) printf '%s\n' "$ALL_PLATFORMS" ;;
    cursor) printf 'cursor-ide cursor-cli\n' ;;
    antigravity) printf 'antigravity-cli antigravity-ide\n' ;;
    claude|shared|cursor-ide|cursor-cli|antigravity-cli|antigravity-ide) printf '%s\n' "$1" ;;
    *) printf 'install-local.sh: unknown platform %s\n' "$1" >&2; usage >&2; exit 2 ;;
  esac
}

platform_kind() {
  case "$1" in
    claude) printf 'marketplace\n' ;;
    shared) printf 'skills\n' ;;
    cursor-ide) printf 'plugin\n' ;;
    cursor-cli) printf 'skills\n' ;;
    antigravity-cli) printf 'skills\n' ;;
    antigravity-ide) printf 'skills\n' ;;
  esac
}

platform_dir() {
  case "$1" in
    claude) printf '%s\n' "$HOME/.claude/plugins" ;;
    shared) printf '%s\n' "$HOME/.agents/skills" ;;
    cursor-ide) printf '%s\n' "$HOME/.cursor/plugins/local/get-evidence" ;;
    cursor-cli) printf '%s\n' "$HOME/.cursor/skills" ;;
    antigravity-cli) printf '%s\n' "$HOME/.gemini/antigravity-cli/skills" ;;
    antigravity-ide) printf '%s\n' "$HOME/.gemini/config/skills" ;;
  esac
}

ALL_PLATFORMS='claude shared cursor-ide cursor-cli antigravity-cli antigravity-ide'

PLATFORM=
SWEEP=no
TARGET=
MODE=link
ACTION=install
KIND=

while [ $# -gt 0 ]; do
  case "$1" in
    --platform) [ $# -ge 2 ] || { usage >&2; exit 2; }
                PLATFORM="${PLATFORM:+$PLATFORM }$(printf '%s' "$2" | tr ',' ' ')"; shift 2 ;;
    --target) [ $# -ge 2 ] || { usage >&2; exit 2; }; TARGET="$2"; shift 2 ;;
    --copy) MODE=copy; shift ;;
    --uninstall) ACTION=uninstall; shift ;;
    --all) SWEEP=yes; shift ;;
    --update) ACTION=update; shift ;;
    -h|--help) usage; exit 0 ;;
    *) printf 'install-local.sh: unexpected argument %s\n' "$1" >&2; usage >&2; exit 2 ;;
  esac
done

if [ "$SWEEP" = yes ]; then
  [ "$ACTION" = uninstall ] || { printf 'install-local.sh: --all only applies to --uninstall\n' >&2; exit 2; }
  [ -z "$TARGET" ] || { printf 'install-local.sh: --all and --target are mutually exclusive\n' >&2; exit 2; }
fi

# Piped into a shell (`curl ... | bash`) stdin is the pipe, so the question goes to the terminal.
ask_on=
if [ -t 0 ]; then ask_on=/dev/stdin
elif { : </dev/tty; } 2>/dev/null; then ask_on=/dev/tty
fi

if [ "$ACTION" != uninstall ] && [ -z "$PLATFORM" ] && [ "$SWEEP" = no ]; then
  if [ -n "$ask_on" ]; then
    say 'Which platform?\n'
    say '  1) Claude Code           its own marketplace, via the claude CLI\n'
    say '  2) Codex or Gemini CLI   skills in ~/.agents/skills\n'
    say '  3) Cursor                IDE and CLI\n'
    say '  4) Antigravity           IDE and CLI\n'
    say '  5) All of them\n'
    say '  6) None of these         exit without writing anything\n'
    printf 'Enter 1-6, several at once (1 2) or empty to exit: '
    read -r choice <"$ask_on" || choice=
    for n in $(printf '%s' "$choice" | tr ',' ' '); do
      case "$n" in
        1) PLATFORM="${PLATFORM:+$PLATFORM }claude" ;;
        2) PLATFORM="${PLATFORM:+$PLATFORM }shared" ;;
        3) PLATFORM="${PLATFORM:+$PLATFORM }cursor" ;;
        4) PLATFORM="${PLATFORM:+$PLATFORM }antigravity" ;;
        5) PLATFORM=all; break ;;
        6) PLATFORM=; break ;;
        *) printf 'install-local.sh: not one of 1-6: %s\n' "$n" >&2; exit 2 ;;
      esac
    done
    [ -n "$PLATFORM" ] || { say '\nNothing installed.\n'; exit 0; }
  else
    PLATFORM=claude
    say 'No terminal to ask on — installing for claude.\n'
  fi
fi

resolve_members() {
  MEMBERS=
  if [ "$SWEEP" = yes ]; then MEMBERS="$ALL_PLATFORMS"; return 0; fi
  local name leaf
  for name in $PLATFORM; do
    for leaf in $(platform_members "$name"); do
      case " $MEMBERS " in *" $leaf "*) ;; *) MEMBERS="${MEMBERS:+$MEMBERS }$leaf" ;; esac
    done
  done
  if [ -n "$TARGET" ] && [ "$(printf '%s\n' $MEMBERS | wc -w)" -gt 1 ]; then
    printf 'install-local.sh: --target takes one platform; named: %s\n' "$(printf '%s ' $MEMBERS)" >&2
    exit 2
  fi
}

if [ "$ACTION" = update ]; then
  say 'updating %s\n' "$REPO"
  git -C "$REPO" pull --ff-only
  ACTION=install
fi

# The skill ships whole — SKILL.md plus the references, templates and Node runner beside it — so a
# platform gets the directory, not a shim pointing back at one.
SKILLS=()
for dir in "$REPO"/src/skills/*/; do
  [ -f "$dir/SKILL.md" ] || continue
  SKILLS+=("$(basename -- "$dir")")
done
[ ${#SKILLS[@]} -gt 0 ] || { printf 'install-local.sh: no skills under %s/src/skills\n' "$REPO" >&2; exit 1; }

# The skill drives a real browser, so it needs its Node dependency and the tools that record and
# encode. Installing the dependency here means the first recording does not stop to do it; a missing
# tool is reported rather than installed, because putting ffmpeg or Chrome on someone's machine is
# not this script's decision to make.
runner_deps() {
  local scripts_dir="$1"
  [ -f "$scripts_dir/package.json" ] || return 0
  if [ -d "$scripts_dir/node_modules" ]; then
    say 'ready   runner dependency already installed\n'
    return 0
  fi
  if ! command -v npm >/dev/null; then
    say 'missing npm — install Node.js, then: npm install --prefix %s\n' "$scripts_dir"
    return 0
  fi
  say 'installing the runner dependency (playwright-core)\n'
  npm install --prefix "$scripts_dir" --no-audit --no-fund >/dev/null 2>&1 \
    || say 'npm install failed — run it yourself: npm install --prefix %s\n' "$scripts_dir"
}

report_missing_tools() {
  local missing=
  command -v node >/dev/null || missing="${missing:+$missing }Node.js"
  command -v ffmpeg >/dev/null || missing="${missing:+$missing }ffmpeg"
  [ -z "$missing" ] || say '\nStill needed before the first recording: %s\n' "$missing"
}

paths_for() {
  local kind="$1" target="$2" name
  if [ "$kind" = skills ]; then
    for name in "${SKILLS[@]}"; do printf '%s\n' "$target/$name"; done
  else
    printf '%s\n' "$target"
  fi
}

# Ours = a symlink into this clone, one laid out the way this script lays one out (the clone may
# have been deleted, leaving links to clear), or a copy carrying the marker.
installed_by_us() {
  local path="$1" name target
  name="$(basename -- "$path")"
  if [ -L "$path" ]; then
    target="$(readlink -- "$path")"
    case "$target" in "$REPO"|"$REPO"/*) return 0 ;; esac
    case "$target" in */src/skills/"$name") return 0 ;; esac
    case "$path" in
      */plugins/local/get-evidence) case "$target" in *get-evidence) return 0 ;; esac ;;
    esac
    return 1
  fi
  [ -f "$path/$STAMP" ] && return 0
  [ -f "$path/SKILL.md" ] && grep -qF -- "$MARKER" "$path/SKILL.md"
}

is_installed() {
  local leaf="$1" kind dir path
  kind="$(platform_kind "$leaf")"
  dir="$(platform_dir "$leaf")"
  if [ "$kind" = marketplace ]; then
    command -v claude >/dev/null || return 1
    claude plugin list </dev/null 2>/dev/null | grep -q 'evidence@webapp-evidence' || return 1
    return 0
  fi
  while IFS= read -r path; do
    { [ -e "$path" ] || [ -L "$path" ]; } && installed_by_us "$path" && return 0
  done <<EOF
$(paths_for "$kind" "$dir")
EOF
  return 1
}

# The CLI failing — not installed, not logged in — must not decide the fate of the other platforms
# in a sweep. Named on its own, the same failure is the answer the user asked for.
claude_failed() {
  if [ "$(printf '%s\n' $MEMBERS | wc -w)" -gt 1 ]; then
    say 'skipped  Claude Code — `claude plugin %s` did not succeed\n' "$1"; return 0
  fi
  printf 'install-local.sh: `claude plugin %s` failed\n' "$1" >&2
  exit 1
}

# Named on its own, a missing CLI is an error; swept up with others, a line to skip.
claude_or_skip() {
  command -v claude >/dev/null && return 0
  if [ "$(printf '%s\n' $MEMBERS | wc -w)" -gt 1 ]; then
    say 'skipped  Claude Code — its CLI is not on PATH\n'; return 1
  fi
  printf 'install-local.sh: the claude CLI is not on PATH\n' >&2
  exit 1
}

removed=0

uninstall_one() {
  local kind="$2" dir="$3" path
  if [ "$kind" = marketplace ]; then
    claude_or_skip || return 0
    claude plugin uninstall "evidence@webapp-evidence" || claude_failed uninstall
    return 0
  fi
  while IFS= read -r path; do
    [ -e "$path" ] || [ -L "$path" ] || continue
    if installed_by_us "$path"; then
      say 'removing %s\n' "$path"; rm -rf -- "$path"; removed=$((removed + 1))
    else
      say 'kept     %s — not installed by this script\n' "$path"
    fi
  done <<EOF
$(paths_for "$kind" "$dir")
EOF
}

install_one() {
  local kind="$2" dir="$3" path name tmp
  if [ "$kind" = marketplace ]; then
    claude_or_skip || return 0
    claude plugin marketplace add "$MARKETPLACE" || { claude_failed "marketplace add"; return 0; }
    claude plugin install "evidence@webapp-evidence" || { claude_failed install; return 0; }
    say '\nInstalled into Claude Code.\n'
    return 0
  fi
  while IFS= read -r path; do
    if { [ -e "$path" ] || [ -L "$path" ]; } && ! installed_by_us "$path"; then
      printf 'install-local.sh: %s exists and was not installed by this script — nothing written\n' "$path" >&2
      exit 1
    fi
  done <<EOF
$(paths_for "$kind" "$dir")
EOF
  if [ "$kind" = skills ]; then
    mkdir -p -- "$dir"
    for name in "${SKILLS[@]}"; do
      path="$dir/$name"
      rm -rf -- "$path"
      if [ "$MODE" = link ]; then
        ln -s -- "$REPO/src/skills/$name" "$path"
        say 'linked  %s\n' "$path"
      else
        cp -R -- "$REPO/src/skills/$name" "$path"
        # A copy carries no link back to the clone, so it needs the marker that tells a later
        # uninstall this directory is ours to remove.
        say '\n%s\n' "$MARKER" >>"$path/SKILL.md"
        say 'copied  %s\n' "$path"
      fi
    done
  else
    mkdir -p -- "$(dirname -- "$dir")"
    rm -rf -- "$dir"
    if [ "$MODE" = link ]; then
      ln -s -- "$REPO" "$dir"; say 'linked  %s\n' "$dir"
    else
      mkdir -p -- "$dir"
      # Tracked AND checked out: `git archive HEAD` would undo a sparse checkout.
      git -C "$REPO" ls-files -z \
        | while IFS= read -r -d '' f; do [ -e "$REPO/$f" ] && printf '%s\0' "$f"; done \
        | tar -C "$REPO" --null -T - -cf - | tar -x -C "$dir"
      say 'installed by get-evidence from %s — safe to delete\n' "$REPO" >"$dir/$STAMP"
      say 'copied  %s\n' "$dir"
    fi
  fi
  say 'ready   %s\n' "$dir"
}

# Uninstalling with nothing named: offer only what is actually installed, the same way installing asks.
if [ "$ACTION" = uninstall ] && [ -z "$PLATFORM" ] && [ "$SWEEP" = no ]; then
  found=
  for leaf in $ALL_PLATFORMS; do is_installed "$leaf" && found="${found:+$found }$leaf"; done
  [ -n "$found" ] || { say 'get-evidence is not installed anywhere this script can see.\n'; exit 0; }
  if [ -n "$ask_on" ]; then
    say 'get-evidence is installed here:\n'
    i=0
    for leaf in $found; do
      i=$((i + 1)); say '  %d) %-18s %s\n' "$i" "$leaf" "$(platform_dir "$leaf")"
    done
    say '  %d) All of them\n' "$((i + 1))"
    say '  %d) None of these\n' "$((i + 2))"
    printf 'Remove which? (numbers, several at once, empty to exit): '
    read -r choice <"$ask_on" || choice=
    [ -n "$choice" ] || choice="$((i + 2))"
    for n in $(printf '%s' "$choice" | tr ',' ' '); do
      case "$n" in ''|*[!0-9]*) printf 'install-local.sh: not a number: %s\n' "$n" >&2; exit 2 ;; esac
      if [ "$n" -eq $((i + 2)) ]; then say '\nNothing removed.\n'; exit 0
      elif [ "$n" -eq $((i + 1)) ]; then PLATFORM="$found"; break
      elif [ "$n" -ge 1 ] && [ "$n" -le "$i" ]; then
        PLATFORM="${PLATFORM:+$PLATFORM }$(printf '%s\n' $found | sed -n "${n}p")"
      else printf 'install-local.sh: not one of 1-%d\n' "$((i + 2))" >&2; exit 2
      fi
    done
  else
    PLATFORM="$found"
    say 'Removing every install found: %s\n' "$found"
  fi
fi

resolve_members

for member in $MEMBERS; do
  kind="$(platform_kind "$member")"
  dir="${TARGET:-$(platform_dir "$member")}"
  if [ "$ACTION" = uninstall ]; then uninstall_one "$member" "$kind" "$dir"
  else install_one "$member" "$kind" "$dir"
  fi
done

if [ "$ACTION" = uninstall ]; then
  say '\n%d removed\n' "$removed"
  exit 0
fi
# In link mode every platform points at the same clone, so its dependency is installed once; a copy
# carries its own.
if [ "$MODE" = link ]; then
  runner_deps "$REPO/src/skills/get-evidence/scripts"
else
  for member in $MEMBERS; do
    [ "$(platform_kind "$member")" = skills ] || continue
    runner_deps "${TARGET:-$(platform_dir "$member")}/get-evidence/scripts"
  done
fi
report_missing_tools
