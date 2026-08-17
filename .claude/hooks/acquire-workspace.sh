#!/usr/bin/env bash
# SessionStart (Claude Code): claim Workspace 1, 2, or 3 for this session.

set -uo pipefail

repo="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null)}"
[ -n "$repo" ] || exit 0
cd "$repo" 2>/dev/null || exit 0

if ! command -v node >/dev/null 2>&1; then
  jq -n '{hookSpecificOutput: {hookEventName: "SessionStart", additionalContext: "Skipped agent workspace acquire: node not on PATH."}}'
  exit 0
fi

export TEMPO_AGENT_TOOL="${TEMPO_AGENT_TOOL:-claude}"
out="$(node scripts/agent-workspace-session.mjs 2>/dev/null || true)"

ctx="$(printf '%s' "$out" | jq -r '.additional_context // empty' 2>/dev/null)"
[ -n "$ctx" ] || exit 0

jq -n --arg c "$ctx" \
  '{hookSpecificOutput: {hookEventName: "SessionStart", additionalContext: $c}}'
