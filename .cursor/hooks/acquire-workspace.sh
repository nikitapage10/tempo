#!/usr/bin/env bash
# sessionStart: claim Workspace 1, 2, or 3 (wait up to ~2 min if all busy).

set -euo pipefail

input="$(cat || true)"

if printf '%s' "$input" | grep -Eq '"is_background_agent"[[:space:]]*:[[:space:]]*true'; then
  printf '%s\n' '{}'
  exit 0
fi

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

if ! command -v node >/dev/null 2>&1; then
  printf '%s\n' '{"additional_context":"Skipped agent workspace acquire: node not on PATH."}'
  exit 0
fi

node scripts/agent-workspace-session.mjs
