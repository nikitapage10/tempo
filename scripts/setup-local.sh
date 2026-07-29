#!/usr/bin/env bash
# One-time (or re-) local setup for TEMPO.
# Usage: npm run setup   OR   bash scripts/setup-local.sh

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo ""
echo "  TEMPO — local setup"
echo "  ==================="
echo ""

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js not found. Install the LTS from https://nodejs.org then re-run."
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "npm not found. Reinstall Node.js (it includes npm), then re-run."
  exit 1
fi

NODE_MAJOR="$(node -p "process.versions.node.split('.')[0]")"
if [[ "$NODE_MAJOR" -lt 18 ]]; then
  echo "Node.js 18+ required (found $(node -v)). Upgrade from https://nodejs.org"
  exit 1
fi

echo "Node $(node -v) / npm $(npm -v)"
echo ""

ENV_FILE=".env.local"
EXAMPLE=".env.local.example"

if [[ ! -f "$EXAMPLE" ]]; then
  echo "Missing $EXAMPLE — is this the TEMPO repo root?"
  exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
  cp "$EXAMPLE" "$ENV_FILE"
  echo "Created $ENV_FILE from $EXAMPLE"
  echo "  → Open it and paste your Supabase API values (see LOCAL-DEVELOPMENT.md)."
else
  echo "Found existing $ENV_FILE (left unchanged)."
fi
echo ""

echo "Installing dependencies…"
npm install
echo ""

missing=0
check_key() {
  local key="$1"
  local required="$2"
  # Match KEY=value where value is non-empty (ignore comments / blanks)
  if grep -E "^${key}=.+" "$ENV_FILE" >/dev/null 2>&1; then
    echo "  ✓ $key is set"
  else
    if [[ "$required" == "required" ]]; then
      echo "  ✗ $key is missing — required to run the app"
      missing=1
    else
      echo "  · $key is unset (optional until you need that feature)"
    fi
  fi
}

echo "Checking $ENV_FILE…"
check_key "NEXT_PUBLIC_SUPABASE_URL" required
check_key "NEXT_PUBLIC_SUPABASE_ANON_KEY" required
check_key "SUPABASE_SERVICE_ROLE_KEY" optional
check_key "INVITE_CODE" optional
check_key "OPENAI_API_KEY" optional
echo ""

if [[ "$missing" -ne 0 ]]; then
  echo "Fill the missing required keys in $ENV_FILE, then:"
  echo "  npm run dev"
  echo ""
  echo "Full guide: LOCAL-DEVELOPMENT.md"
  exit 1
fi

echo "Ready. Start the local app with:"
echo "  npm run dev"
echo ""
echo "Then open http://localhost:3000"
echo "Mac: you can also double-click \"Launch TEMPO.command\""
echo ""
echo "Guide: LOCAL-DEVELOPMENT.md"
echo ""
