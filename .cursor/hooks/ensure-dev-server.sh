#!/usr/bin/env bash
# sessionStart: start Next.js (`npm run dev`) if nothing is listening on the port.
# Fire-and-forget — the agent chat does not wait for Ready.

set -euo pipefail

input="$(cat || true)"

# Background agents should not spawn a long-lived local server.
if printf '%s' "$input" | grep -Eq '"is_background_agent"[[:space:]]*:[[:space:]]*true'; then
  printf '%s\n' '{}'
  exit 0
fi

PORT="${TEMPO_DEV_PORT:-3000}"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

port_is_open() {
  lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1
}

if port_is_open; then
  printf '%s\n' "{\"additional_context\":\"TEMPO dev server is already listening on http://localhost:${PORT}.\"}"
  exit 0
fi

if ! command -v npm >/dev/null 2>&1; then
  printf '%s\n' '{"additional_context":"Could not start TEMPO dev server: npm was not found on PATH."}'
  exit 0
fi

LOG_DIR="${TMPDIR:-/tmp}/tempo-dev-server"
mkdir -p "$LOG_DIR"
LOG="$LOG_DIR/next-dev.log"
LOCK="$LOG_DIR/start.lock"

# Avoid racing multiple new chats into several next processes.
if ! mkdir "$LOCK" 2>/dev/null; then
  for _ in 1 2 3 4 5 6 7 8 9 10 11 12; do
    if port_is_open; then
      printf '%s\n' "{\"additional_context\":\"TEMPO dev server is already listening on http://localhost:${PORT}.\"}"
      exit 0
    fi
    sleep 0.5
  done
  printf '%s\n' "{\"additional_context\":\"TEMPO dev server start is already in progress. Check http://localhost:${PORT} shortly. Logs: ${LOG}\"}"
  exit 0
fi

cleanup_lock() {
  rmdir "$LOCK" 2>/dev/null || true
}
trap cleanup_lock EXIT

# Fully detach from the hook process group so the server survives hook exit.
# macOS has no setsid(1); use Python's start_new_session instead.
python3 - "$ROOT" "$LOG" <<'PY'
import os
import subprocess
import sys

root, log_path = sys.argv[1], sys.argv[2]
os.chdir(root)
with open(log_path, "a", encoding="utf-8") as log:
    log.write("\n--- ensure-dev-server start ---\n")
    log.flush()
    subprocess.Popen(
        ["npm", "run", "dev", "--", "-p", os.environ.get("TEMPO_DEV_PORT", "3000")],
        stdin=subprocess.DEVNULL,
        stdout=log,
        stderr=subprocess.STDOUT,
        start_new_session=True,
        env=os.environ.copy(),
    )
PY

# Brief wait so a second chat in the same second sees the listener or lock.
for _ in 1 2 3 4 5 6 7 8 9 10; do
  if port_is_open; then
    printf '%s\n' "{\"additional_context\":\"Started TEMPO dev server with npm run dev (http://localhost:${PORT}).\"}"
    exit 0
  fi
  sleep 0.5
done

printf '%s\n' "{\"additional_context\":\"Started TEMPO dev server with npm run dev (http://localhost:${PORT}). It may take a few more seconds to become ready. Logs: ${LOG}\"}"
exit 0
