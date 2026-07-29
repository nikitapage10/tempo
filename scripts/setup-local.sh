#!/usr/bin/env bash
# Thin wrapper — prefer: npm run setup  (uses scripts/setup-local.js)
exec node "$(cd "$(dirname "$0")" && pwd)/setup-local.js" "$@"
