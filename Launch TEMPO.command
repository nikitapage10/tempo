#!/bin/zsh
# Double-click this file in Finder to launch a local TEMPO instance.
# A Terminal window will stay open while the app runs — close it (or Ctrl+C) to stop.

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

if [[ ! -f .env.local ]]; then
  echo "Missing .env.local — copy .env.local.example and fill in your Supabase keys."
  pause
  exit 1
fi

if [[ ! -d node_modules ]]; then
  echo "Installing dependencies (first run only)…"
  "$NPM_BIN" install
  echo ""
fi

PORT=3000
URL="http://localhost:${PORT}"

if curl -sf -o /dev/null --max-time 1 "$URL" 2>/dev/null; then
  echo "TEMPO is already running at $URL — opening browser."
  open "$URL"
  pause
  exit 0
fi

echo "Starting TEMPO at $URL"
echo "Leave this window open. Press Ctrl+C to stop."
echo ""

(
  for _ in {1..90}; do
    if curl -sf -o /dev/null --max-time 1 "$URL" 2>/dev/null; then
      open "$URL"
      exit 0
    fi
    sleep 0.5
  done
) &

"$NPM_BIN" run dev -- --port "$PORT"
status=$?
if [[ $status -ne 0 ]]; then
  echo ""
  echo "Dev server exited with code $status."
  pause
fi
exit $status
