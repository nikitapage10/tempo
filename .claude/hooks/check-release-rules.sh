#!/usr/bin/env bash
# Blocks `git push` unless the REQUIRED release rules in .cursorrules were followed:
#   - lib/version.ts APP_VERSION bumped
#   - package.json version bumped, and matching APP_VERSION
#   - CHANGELOG.md updated
#
# Wired up as a PreToolUse hook on Bash in .claude/settings.json.
# Fails open (exit 0, no output) on anything unexpected — a broken hook must
# never wedge the repo. It only ever blocks on a check it positively evaluated.

set -uo pipefail

# Gate on the command ourselves rather than relying on the settings `if` filter,
# which matched far more than `git push` in practice — and since this hook can
# emit a deny, an over-broad match blocks every unrelated Bash command.
payload=$(cat 2>/dev/null || true)
cmd=$(printf '%s' "$payload" | jq -r '.tool_input.command // empty' 2>/dev/null)
# Match `git push` only where it is actually invoked — at the start of the
# command or after a shell separator — so prose mentioning it isn't blocked.
printf '%s' "$cmd" | grep -qE '(^|[;&|(]|&&|\|\|)[[:space:]]*git[[:space:]]+([^;&|]*[[:space:]]+)?push([[:space:]]|$)' || exit 0

repo_root=$(git rev-parse --show-toplevel 2>/dev/null) || exit 0
cd "$repo_root" || exit 0

# Only guard the TEMPO repo; the hook is project-scoped but be defensive.
[ -f lib/version.ts ] || exit 0
[ -f package.json ] || exit 0

deny() {
  printf '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":%s}}\n' \
    "$(printf '%s' "$1" | jq -Rs .)"
  exit 0
}

# What would this push actually send?
upstream=$(git rev-parse --abbrev-ref --symbolic-full-name '@{u}' 2>/dev/null)
range="${upstream:-origin/main}..HEAD"

count=$(git rev-list --count "$range" 2>/dev/null) || exit 0
# Nothing new to push (or an unresolvable range) — let it through.
[ -z "$count" ] && exit 0
[ "$count" -eq 0 ] && exit 0

files=$(git diff --name-only "$range" 2>/dev/null) || exit 0

# Escape hatch for changes with no app-facing version (tooling, CI, hooks, docs).
# EVERY pending commit must carry the marker — otherwise one exempt commit would
# smuggle unmarked ones past the check when they are pushed together.
marked=$(git rev-list "$range" 2>/dev/null | while read -r sha; do
  git log -1 --format=%B "$sha" 2>/dev/null | grep -qF '[skip-release-check]' && echo "$sha"
done | wc -l | tr -d '[:space:]')
if [ -n "$marked" ] && [ "$marked" -eq "$count" ]; then
  exit 0
fi

problems=""
grep -qx 'CHANGELOG.md'  <<<"$files" || problems+="  - CHANGELOG.md has no entry for these commits"$'\n'
grep -qx 'lib/version.ts' <<<"$files" || problems+="  - lib/version.ts APP_VERSION was not bumped"$'\n'
grep -qx 'package.json'   <<<"$files" || problems+="  - package.json version was not bumped"$'\n'

# The two versions must agree with each other.
app_ver=$(sed -n 's/.*APP_VERSION *= *"\([^"]*\)".*/\1/p' lib/version.ts | head -1)
pkg_ver=$(jq -r '.version // empty' package.json 2>/dev/null)
if [ -n "$app_ver" ] && [ -n "$pkg_ver" ] && [ "$app_ver" != "$pkg_ver" ]; then
  problems+="  - version mismatch: lib/version.ts says $app_ver, package.json says $pkg_ver"$'\n'
fi

[ -z "$problems" ] && exit 0

deny "Push blocked — .cursorrules requires these on every change ($count commit(s) pending on $range):

$problems
Fix, amend or add a commit, then push again.
Semver for TEMPO (still 0.x): patch = bug fix or tiny tweak, minor = new feature or meaningful behavior/UI change."
