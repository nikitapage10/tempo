#!/bin/zsh
# Double-click this file in Finder to start or open TEMPO's shared local preview.

set -euo pipefail

cd "$(cd "$(dirname "$0")" && pwd)"

# Finder-launched Terminals often miss Homebrew / nvm Node. Load common paths.
export PATH="/usr/local/bin:/opt/homebrew/bin:$HOME/.local/bin:$PATH"
if [[ -f "$HOME/.zshrc" ]]; then
  # shellcheck disable=SC1090
  source "$HOME/.zshrc" >/dev/null 2>&1 || true
elif [[ -f "$HOME/.zprofile" ]]; then
  # shellcheck disable=SC1090
  source "$HOME/.zprofile" >/dev/null 2>&1 || true
fi
if [[ -s "$HOME/.nvm/nvm.sh" ]]; then
  # shellcheck disable=SC1090
  source "$HOME/.nvm/nvm.sh" >/dev/null 2>&1 || true
fi

pause() {
  echo ""
  echo -n "Press Enter to close…"
  read -r _
}

echo ""
echo "  TEMPO — local studio"
echo "  ===================="
echo ""

NODE_BIN="$(command -v node || true)"
NPM_BIN="$(command -v npm || true)"

if [[ -z "$NODE_BIN" ]]; then
  for candidate in /usr/local/bin/node /opt/homebrew/bin/node; do
    if [[ -x "$candidate" ]]; then
      NODE_BIN="$candidate"
      export PATH="$(dirname "$candidate"):$PATH"
      break
    fi
  done
fi

if [[ -z "$NPM_BIN" ]]; then
  NPM_BIN="$(command -v npm || true)"
fi

if [[ -z "$NODE_BIN" || -z "$NPM_BIN" ]]; then
  echo "Couldn’t find Node.js / npm from this launcher."
  echo "Open Terminal, run:  which node && which npm"
  echo "Then install Node from https://nodejs.org if either is missing."
  pause
  exit 1
fi

if [[ ! -d node_modules ]]; then
  echo "Installing dependencies (first run only)…"
  "$NPM_BIN" install
  echo ""
fi

URL="http://localhost:3000"

echo "Starting or reusing TEMPO at $URL"
echo ""

"$NPM_BIN" run dev
status=$?
if [[ $status -ne 0 ]]; then
  echo ""
  echo "The shared preview could not start."
  pause
  exit $status
fi

open "$URL"
echo "TEMPO is open. The shared preview keeps running in the background."
echo "To stop it later, run: npm run dev:stop"
pause
exit 0
