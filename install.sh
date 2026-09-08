#!/usr/bin/env bash
# One command to install webapp-evidence:
#
#   curl -fsSL https://raw.githubusercontent.com/TOMOSIA-VIETNAM/webapp-evidence/main/install.sh | bash
#
# It installs nothing itself: it puts a clone in ~/.webapp-evidence at the latest release tag and hands
# over to that clone's scripts/install-local.sh, which is the code that runs. Read it there
# afterwards. Add --uninstall to remove.
#
# Env: WEBAPP_EVIDENCE_HOME · WEBAPP_EVIDENCE_REF (default: latest release tag) · WEBAPP_EVIDENCE_REPO
#
# This file is fetched from the default branch; the tag pins the clone it leaves behind.
set -euo pipefail
# Exactly what a run needs. Everything else — tests, docs, tooling, agent instructions aimed at
# people editing THIS project — has no business on the disk of someone using it. An include list, so
# a file added to the repository stays out until named here.
SHIP='/src/ /scripts/install-local.sh
      /LICENSE /README.md /commands/ /.agents/ /.claude-plugin/
      /.codex-plugin/ /gemini-extension.json /.cursor-plugin/ /plugin.json'

trap '' PIPE
say() { printf "$@" 2>/dev/null || true; }

# A .git directory is not proof the clone is ours, and a fork keeps the repository name: compare
# owner/repo, which also makes ssh and https spellings agree.
slug() { printf '%s\n' "${1%.git}" | sed 's#.*[:/]\([^/:]*/[^/]*\)$#\1#'; }
is_our_clone() {
  local url repo="$2"
  url="$(git -C "$1" remote get-url origin 2>/dev/null)" || return 1
  [ "$url" = "$repo" ] || [ "$(slug "$url")" = "$(slug "$repo")" ]
}

# Everything lives in main so a download cut short cannot execute half a script.
main() {
  local repo="${WEBAPP_EVIDENCE_REPO:-https://github.com/TOMOSIA-VIETNAM/webapp-evidence}"
  local home="${WEBAPP_EVIDENCE_HOME:-$HOME/.webapp-evidence}"
  local ref="${WEBAPP_EVIDENCE_REF:-}"
  local uninstalling=no targeted=no arg tmp=

  for arg in "$@"; do
    case "$arg" in
      --uninstall) uninstalling=yes ;;
      --platform|--all|--target) targeted=yes ;;
    esac
  done

  command -v git >/dev/null || { printf 'install.sh: git is required\n' >&2; exit 1; }

  if [ -z "$ref" ]; then
    ref="$(git ls-remote --tags --refs "$repo" 'v[0-9]*' 2>/dev/null \
           | awk -F/ '{print $NF}' | sort -t. -k1.2,1n -k2,2n -k3,3n | tail -1)"
    [ -n "$ref" ] || ref=main
  fi

  # Removing needs no update: run the installer already on disk, and borrow a throwaway clone only
  # when there is none — someone who deleted the clone by hand still has links to clear.
  if [ "$uninstalling" = yes ]; then
    local runner=
    if [ -d "$home/.git" ] && is_our_clone "$home" "$repo"; then
      runner="$home/scripts/install-local.sh"
    else
      tmp="$(mktemp -d)"
      say 'fetching the uninstaller from %s\n' "$ref"
      git clone --quiet --depth 1 --sparse --filter=blob:none --branch "$ref" "$repo" "$tmp/p" 2>/dev/null \
        || git clone --quiet --depth 1 --branch "$ref" "$repo" "$tmp/p" 2>/dev/null \
        || git clone --quiet --depth 1 "$repo" "$tmp/p"
      # shellcheck disable=SC2086
      git -C "$tmp/p" sparse-checkout set --no-cone $SHIP 2>/dev/null || true
      runner="$tmp/p/scripts/install-local.sh"
    fi
    [ -x "$runner" ] || { printf 'install.sh: no uninstaller at %s\n' "$ref" >&2
                          [ -z "$tmp" ] || rm -rf "$tmp"; exit 1; }
    local rc=0
    "$runner" "$@" || rc=$?
    [ -z "$tmp" ] || rm -rf "$tmp"
    if [ "$rc" -eq 0 ] && [ "$targeted" = no ] && [ -d "$home/.git" ]; then
      rm -rf "$home"; say 'removed %s\n' "$home"
    fi
    exit "$rc"
  fi

  if [ -d "$home/.git" ] && is_our_clone "$home" "$repo"; then
    say 'updating %s to %s\n' "$home" "$ref"
    # A clone made with --branch narrows its fetch refspec to that ref, so ask for this one by name.
    git -C "$home" fetch --quiet --depth 1 origin "$ref" 2>/dev/null \
      || git -C "$home" fetch --quiet --tags origin "$ref" \
      || { printf 'install.sh: %s has no ref named %s\n' "$repo" "$ref" >&2; exit 1; }
    git -C "$home" checkout --quiet --detach FETCH_HEAD
  elif [ -e "$home" ]; then
    printf 'install.sh: %s exists and is not a clone of webapp-evidence — move it, nothing written\n' "$home" >&2
    exit 1
  else
    say 'cloning %s at %s into %s\n' "$repo" "$ref" "$home"
    git clone --quiet --branch "$ref" --depth 1 --sparse --filter=blob:none "$repo" "$home" 2>/dev/null \
      || git clone --quiet --branch "$ref" --depth 1 --sparse "$repo" "$home" 2>/dev/null \
      || git clone --quiet --branch "$ref" --depth 1 "$repo" "$home"
    # shellcheck disable=SC2086
    [ -d "$home/.git" ] && git -C "$home" sparse-checkout set --no-cone $SHIP 2>/dev/null || true
  fi

  [ -x "$home/scripts/install-local.sh" ] || {
    printf 'install.sh: %s/scripts/install-local.sh is missing\n' "$home" >&2; exit 1; }
  say '\nRead what does the rest: %s/scripts/install-local.sh\n\n' "$home"
  exec "$home/scripts/install-local.sh" "$@"
}

main "$@"
