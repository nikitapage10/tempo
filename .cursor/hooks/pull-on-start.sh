#!/usr/bin/env bash
# sessionStart: if this clone is behind GitHub and can safely fast-forward, pull.
# Never force, never merge, never touch a dirty or diverged tree.

set -euo pipefail

input="$(cat || true)"

# Background agents should not mutate the working tree.
if printf '%s' "$input" | grep -Eq '"is_background_agent"[[:space:]]*:[[:space:]]*true'; then
  printf '%s\n' '{}'
  exit 0
fi

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

json_ctx() {
  # Escape backslashes and quotes for a minimal JSON string.
  local msg="$1"
  msg="${msg//\\/\\\\}"
  msg="${msg//\"/\\\"}"
  printf '%s\n' "{\"additional_context\":\"${msg}\"}"
}

if ! command -v git >/dev/null 2>&1; then
  json_ctx "Skipped Git sync on startup: git was not found on PATH."
  exit 0
fi

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  json_ctx "Skipped Git sync on startup: this folder is not a Git repo."
  exit 0
fi

if ! git remote get-url origin >/dev/null 2>&1; then
  json_ctx "Skipped Git sync on startup: no origin remote configured."
  exit 0
fi

branch="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || true)"
if [[ -z "$branch" || "$branch" == "HEAD" ]]; then
  json_ctx "Skipped Git sync on startup: detached HEAD (not on a branch)."
  exit 0
fi

# Need an upstream to know what "behind" means.
if ! git rev-parse --abbrev-ref '@{upstream}' >/dev/null 2>&1; then
  json_ctx "Skipped Git sync on startup: branch '${branch}' has no upstream. Push once with -u to set it."
  exit 0
fi

# Check GitHub for newer commits (does not change local files).
if ! git fetch --quiet origin 2>/dev/null; then
  json_ctx "Skipped Git sync on startup: could not reach GitHub (fetch failed)."
  exit 0
fi

behind="$(git rev-list --count 'HEAD..@{upstream}' 2>/dev/null || echo 0)"
ahead="$(git rev-list --count '@{upstream}..HEAD' 2>/dev/null || echo 0)"

if [[ "$behind" -eq 0 ]]; then
  if [[ "$ahead" -gt 0 ]]; then
    json_ctx "Git is up to date with remote history you already have; local branch is ahead by ${ahead} commit(s) (push when ready)."
  else
    json_ctx "Git is already in sync with GitHub."
  fi
  exit 0
fi

# Behind GitHub. Only auto-update on a clean fast-forward.
if [[ "$ahead" -gt 0 ]]; then
  json_ctx "Local branch and GitHub have diverged (behind ${behind}, ahead ${ahead}). Skipped auto-pull — resolve manually."
  exit 0
fi

if [[ -n "$(git status --porcelain 2>/dev/null || true)" ]]; then
  json_ctx "GitHub is ahead by ${behind} commit(s), but this machine has uncommitted changes. Skipped auto-pull — commit/stash, then pull."
  exit 0
fi

if git pull --ff-only --quiet; then
  json_ctx "Pulled ${behind} commit(s) from GitHub (fast-forward). Local repo is now up to date."
  exit 0
fi

json_ctx "GitHub is ahead by ${behind} commit(s), but fast-forward pull failed. Skipped auto-update — pull manually."
exit 0
