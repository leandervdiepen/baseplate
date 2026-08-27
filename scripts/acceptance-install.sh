#!/usr/bin/env bash
# The definition of done, proven against what an operator downloads rather than
# against this checkout. Packs, installs into a scratch project, brings a stack
# up from the installed package, and runs every acceptance script against it.
set -euo pipefail

cd "$(dirname "$0")/.."
ROOT="$PWD"
WORK="$(mktemp -d)"
TARBALL=""

cleanup() {
  if [ -x "$WORK/node_modules/.bin/baseplate" ]; then
    BASEPLATE_PROJECT="$WORK" "$WORK/node_modules/.bin/baseplate" destroy --yes || true
  fi
  rm -rf "$WORK"
  if [ -n "$TARBALL" ]; then
    rm -f "$ROOT/$TARBALL"
  fi
}
trap cleanup EXIT

echo "artifact: packing"
TARBALL="$(npm pack --silent)"

echo "artifact: installing $TARBALL into a clean project"
cd "$WORK"
npm init -y >/dev/null
npm install --no-audit --no-fund --silent "$ROOT/$TARBALL"
CLI="$WORK/node_modules/.bin/baseplate"
export BASEPLATE_PROJECT="$WORK"

echo "artifact: baseplate init"
"$CLI" init

echo "artifact: baseplate up"
"$CLI" up

cd "$ROOT"
echo "artifact: acceptance against the installed package"
BASEPLATE_CLI="$CLI" npm run test:acceptance

echo "artifact ok"
