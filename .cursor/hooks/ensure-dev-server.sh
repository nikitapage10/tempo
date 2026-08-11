#!/usr/bin/env bash
# sessionStart: reuse or start TEMPO's one coordinated local preview.

set -u

input="$(cat || true)"

# Background agents should not change which worktree the user is previewing.
if printf '%s' "$input" | grep -Eq '"is_background_agent"[[:space:]]*:[[:space:]]*true'; then
  printf '%s\n' '{}'
  exit 0
fi

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT" || exit 0

# The Node coordinator owns locking, detachment, port checks, and shared env.
# It never chooses a fallback port and never switches an existing preview.
if npm run dev --silent >/dev/null 2>&1; then
  printf '%s\n' '{"additional_context":"TEMPO uses one shared preview at http://localhost:3000. Open that URL; use npm run dev:status to see which branch is live and npm run dev:switch only when the user asks to preview this worktree."}'
else
  printf '%s\n' '{"additional_context":"TEMPO preview could not start or port 3000 belongs to an older server. Do not choose another port. Run npm run dev for the exact diagnosis, then preserve the canonical http://localhost:3000 URL."}'
fi
exit 0
