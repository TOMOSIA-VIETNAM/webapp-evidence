#!/usr/bin/env bash
# One command to install webapp-evidence:
#
#   curl -fsSL https://raw.githubusercontent.com/TOMOSIA-VIETNAM/webapp-evidence/main/install.sh | bash
#
# It installs nothing itself: it puts a clone in ~/.webapp-evidence at the latest release tag and hands
# over to that clone's scripts/install-local.sh, which is the code that runs. Read it there
# afterwards. Add --uninstall to remove.
#
# Args: --ref <branch-or-tag> installs that ref instead of the newest release, and every later run
# stays on it; `--ref latest` returns to the release channel. Everything else is passed through to
# install-local.sh.
#
# Env: WEBAPP_EVIDENCE_HOME (default ~/.webapp-evidence) · WEBAPP_EVIDENCE_REF (same as --ref) ·
# WEBAPP_EVIDENCE_REPO
#
# This file itself is fetched from the default branch; the ref below pins the clone it leaves
# behind, which is what actually runs.
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

# A ref this clone follows can stop existing — a branch merged and deleted is the ordinary case, and
# then every later run of the one-liner fails on a name the user never typed. Say which ref, say
# where it came from, and give the way out; exiting with only "no ref named X" leaves someone stuck
# with no idea that `--ref latest` is the answer.
missing_ref() {
  local repo="$1" ref="$2" named="$3" home="$4"
  printf 'install.sh: %s has no ref named %s\n' "$repo" "$ref" >&2
  if [ "$named" = no ]; then
    printf '  This clone follows %s because an earlier install asked for it. A branch that has since\n' "$ref" >&2
    printf '  been merged and deleted looks exactly like this.\n' >&2
  fi
  printf '\n  Go back to released versions:  curl -fsSL %s/raw/HEAD/install.sh | bash -s -- --ref latest\n' \
    "${repo%.git}" >&2
  printf '  Or follow something else:      ... | bash -s -- --ref <branch-or-tag>\n' >&2
  printf '  Or start over:                 rm -rf %s\n' "$home" >&2
  exit 1
}

# Everything lives in main so a download cut short cannot execute half a script.
main() {
  local repo="${WEBAPP_EVIDENCE_REPO:-https://github.com/TOMOSIA-VIETNAM/webapp-evidence}"
  local home="${WEBAPP_EVIDENCE_HOME:-$HOME/.webapp-evidence}"
  # `ref` is what to check out now; `pinned` is what the clone should follow from here on, where an
  # empty value means the release channel. `named=no` says this run mentioned no ref at all, and
  # then an existing clone keeps following whatever it already followed.
  local ref="${WEBAPP_EVIDENCE_REF:-}" pinned="${WEBAPP_EVIDENCE_REF:-}" named=no
  [ -z "$ref" ] || named=yes
  local uninstalling=no targeted=no tmp=
  # What install-local.sh receives: its own flags, none of ours.
  local -a pass=()

  while [ $# -gt 0 ]; do
    case "$1" in
      --ref) [ $# -ge 2 ] && [ -n "$2" ] || {
               printf 'install.sh: --ref needs a branch or tag name, or `latest`\n' >&2; exit 2; }
             ref="$2"; pinned="$2"; named=yes; shift 2 ;;
      --ref=?*) ref="${1#--ref=}"; pinned="$ref"; named=yes; shift ;;
      --ref=) printf 'install.sh: --ref needs a branch or tag name, or `latest`\n' >&2; exit 2 ;;
      --uninstall) uninstalling=yes; pass+=("$1"); shift ;;
      --platform|--all|--target) targeted=yes; pass+=("$1"); shift ;;
      *) pass+=("$1"); shift ;;
    esac
  done

  command -v git >/dev/null || { printf 'install.sh: git is required\n' >&2; exit 1; }

  # `latest` is the way back from a branch to the release channel: ask for a release, and follow
  # nothing afterwards.
  if [ "$ref" = latest ]; then ref=; pinned=; fi

  # A clone already following a ref stays on it, so re-running the one-liner to update does not drop
  # someone off the branch they installed on purpose.
  if [ "$named" = no ] && [ -d "$home/.git" ] && is_our_clone "$home" "$repo"; then
    ref="$(git -C "$home" config --get webapp-evidence.ref 2>/dev/null || true)"
    pinned="$ref"
  fi

  if [ -z "$ref" ]; then
    # Highest release tag, so the one-liner never lands on an unreleased commit. With no tags yet,
    # the default branch is the only thing there is to install.
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
    "$runner" ${pass+"${pass[@]}"} || rc=$?
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
      || git -C "$home" fetch --quiet --tags origin "$ref" 2>/dev/null \
      || missing_ref "$repo" "$ref" "$named" "$home"
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

  # What this clone follows from now on, kept in its own git config so a checkout cannot lose it and
  # nothing tracked has to carry it. Following the release channel is the absence of a value, which
  # is what `--ref latest` restores.
  if [ -n "$pinned" ]; then
    git -C "$home" config webapp-evidence.ref "$pinned"
    say 'following %s — `--ref latest` returns to releases\n' "$pinned"
  else
    git -C "$home" config --unset webapp-evidence.ref 2>/dev/null || true
  fi

  say '\nRead what does the rest: %s/scripts/install-local.sh\n\n' "$home"
  exec "$home/scripts/install-local.sh" ${pass+"${pass[@]}"}
}

main "$@"
