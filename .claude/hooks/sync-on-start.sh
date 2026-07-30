#!/usr/bin/env bash
# SessionStart hook — keeps this clone in sync with GitHub across machines.
#
# Fast-forwards only when that is provably lossless (no local commits, no
# modified tracked files). In every other case it reports and changes nothing:
# never commits, never rebases, never resets, never force-pushes.

set -uo pipefail

repo="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null)}"
[ -n "$repo" ] || exit 0
cd "$repo" 2>/dev/null || exit 0
git rev-parse --git-dir >/dev/null 2>&1 || exit 0

payload=$(cat 2>/dev/null || true)
event=$(printf '%s' "$payload" | jq -r '.source // "startup"' 2>/dev/null || echo startup)

# $1 = one-line message for the user, $2 = state description for Claude
emit() {
  jq -n --arg m "$1" --arg c "$2" \
    '{systemMessage: $m, suppressOutput: true,
      hookSpecificOutput: {hookEventName: "SessionStart", additionalContext: $c}}'
  exit 0
}

# Cross-machine pulls stay linear. Repo-local config, so each clone self-configures.
git config pull.rebase true 2>/dev/null

branch=$(git symbolic-ref --short -q HEAD) ||
  emit "Sync: detached HEAD — skipped." "Repo is in detached HEAD state; no sync check ran."

upstream=$(git rev-parse --abbrev-ref --symbolic-full-name "@{upstream}" 2>/dev/null) ||
  emit "Sync: '$branch' has no upstream." "Branch $branch has no upstream branch; nothing to sync against."

git fetch --quiet origin 2>/dev/null ||
  emit "Sync: can't reach GitHub — working from local state." \
       "git fetch failed (offline or auth). Sync state versus origin is unknown this session."

counts=$(git rev-list --left-right --count "$upstream...HEAD" 2>/dev/null) || exit 0
behind=$(printf '%s' "$counts" | cut -f1)
ahead=$(printf '%s' "$counts" | cut -f2)

# Tracked-file changes only. Untracked files don't block a fast-forward, and if
# an incoming commit does collide with one, git refuses the merge on its own.
dirty=$(git status --porcelain --untracked-files=no | wc -l | tr -d ' ')

if [ "$behind" -eq 0 ] && [ "$ahead" -eq 0 ] && [ "$dirty" -eq 0 ]; then
  emit "Sync: $branch matches $upstream." "$branch is in sync with $upstream, working tree clean."
fi

if [ "$behind" -gt 0 ] && [ "$ahead" -gt 0 ]; then
  emit "⚠ Sync: $branch has diverged — $ahead local, $behind on GitHub. Resolve before working." \
       "$branch has diverged from $upstream: $ahead unpushed local commits and $behind remote commits. NOT auto-resolved. Run 'git pull --rebase' and resolve conflicts before making changes. Do not force-push — the other machine's work is in those remote commits."
fi

if [ "$behind" -gt 0 ] && [ "$dirty" -gt 0 ]; then
  emit "⚠ Sync: $behind commit(s) on GitHub, but $dirty modified file(s) here — not pulled." \
       "$upstream is $behind commits ahead but the working tree has $dirty modified tracked files, so no pull happened. Commit or stash, then 'git pull --rebase', before making changes."
fi

if [ "$behind" -gt 0 ]; then
  # Only move files on a genuinely new session. On resume/clear/compact the tree
  # may be mid-task, so report instead of changing anything underneath it.
  if [ "$event" != "startup" ]; then
    emit "Sync: $behind commit(s) on GitHub — not pulled mid-session ($event)." \
         "$upstream is $behind commits ahead. No pull happened because this is a '$event', not a fresh start. Run 'git pull --rebase' if you want them now."
  fi

  # Clean tree, no local commits: fast-forward is lossless.
  if out=$(git merge --ff-only "$upstream" 2>&1); then
    files=$(git diff --name-only "HEAD@{1}" HEAD 2>/dev/null | wc -l | tr -d ' ')
    deps=""
    git diff --name-only "HEAD@{1}" HEAD 2>/dev/null | grep -q '^package\(-lock\)\?\.json$' &&
      deps=" package.json changed — 'npm install' may be needed."
    emit "Sync: pulled $behind commit(s) from GitHub ($files file(s) changed).$deps" \
         "Fast-forwarded $branch to $upstream: $behind new commits from the other machine, $files files changed.$deps Files on disk are newer than anything discussed earlier in this session."
  fi
  emit "⚠ Sync: $behind commit(s) on GitHub — fast-forward failed." \
       "Fast-forward of $branch to $upstream failed: $out"
fi

emit "Sync: $ahead unpushed commit(s) on $branch." \
     "$branch has $ahead commits not yet pushed to $upstream. Push before switching machines. Release rules (version bump, CHANGELOG, PRODUCT.md) cover the whole unpushed range."
