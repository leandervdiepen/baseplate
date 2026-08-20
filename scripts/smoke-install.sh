#!/usr/bin/env bash
# Proves the package works the way an operator gets it: packed, installed, and
# run from somewhere else. Every path that is only true in this checkout dies
# here rather than in someone's terminal.
set -euo pipefail

cd "$(dirname "$0")/.."
ROOT="$PWD"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK" "$ROOT/${TARBALL:-nothing-to-remove}"' EXIT

echo "smoke: packing"
TARBALL="$(npm pack --silent)"

echo "smoke: installing $TARBALL into a clean project"
cd "$WORK"
npm init -y >/dev/null
npm install --no-audit --no-fund --silent "$ROOT/$TARBALL"

echo "smoke: baseplate --version"
npx baseplate --version

echo "smoke: baseplate init"
npx baseplate init >/dev/null

echo "smoke: baseplate dashboard"
PORT=8799
npx baseplate dashboard --port "$PORT" >"$WORK/dashboard.log" 2>&1 &
PID=$!
for _ in $(seq 1 60); do
  if grep -q "http://127.0.0.1:$PORT" "$WORK/dashboard.log" 2>/dev/null; then
    break
  fi
  if ! kill -0 "$PID" 2>/dev/null; then
    echo "smoke: the studio exited before it listened"
    cat "$WORK/dashboard.log"
    exit 1
  fi
  sleep 1
done
kill "$PID" 2>/dev/null || true
wait "$PID" 2>/dev/null || true

if ! grep -q "http://127.0.0.1:$PORT" "$WORK/dashboard.log"; then
  echo "smoke: the studio never printed its address"
  cat "$WORK/dashboard.log"
  exit 1
fi

echo "smoke ok"
