#!/usr/bin/env bash
# Each stack service's dependencies from its own lockfile, the way its
# Dockerfile does. For contributors; an operator never runs this.
set -euo pipefail

cd "$(dirname "$0")/.."

for service in auth backup migrate storage; do
  echo "stack-deps: $service"
  npm ci --prefix "stack/$service" --no-audit --no-fund --silent
done

echo "stack-deps ok"
