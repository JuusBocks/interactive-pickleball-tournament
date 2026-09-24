#!/bin/zsh
set -euo pipefail

cd /Users/leounib/.local/share/pickleball-bracket

exec /Users/leounib/.local/bin/node --import ./scripts/sites-env.mjs \
  ./node_modules/wrangler/bin/wrangler.js dev \
  --config dist/server/wrangler.json \
  --local \
  --persist-to .wrangler/state \
  --ip 0.0.0.0 \
  --port 8787 \
  --inspector-port 0
