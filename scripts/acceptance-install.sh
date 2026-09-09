#!/usr/bin/env bash
# The definition of done, proven against what an operator downloads rather than
# against this checkout. Packs, installs into a scratch project, brings a stack
# up from the installed package, and runs every acceptance script against it.
set -euo pipefail

cd "$(dirname "$0")/.."
ROOT="$PWD"
WORK="$(mktemp -d)"
TARBALL=""

free_ports() {
  node --input-type=module -e '
    import { createServer } from "node:net";
    const servers = [createServer(), createServer(), createServer()];
    await Promise.all(servers.map((server) => new Promise((resolve) => {
      server.listen(0, "127.0.0.1", resolve);
    })));
    const ports = servers.map((server) => {
      const address = server.address();
      if (!address || typeof address === "string") process.exit(1);
      return address.port;
    });
    console.log(ports.join(" "));
    await Promise.all(servers.map((server) => new Promise((resolve) => server.close(resolve))));
  '
}

read -r HTTP_PORT POSTGRES_PORT MAILPIT_PORT < <(free_ports)

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
"$CLI" init \
  --port "$HTTP_PORT" \
  --postgres-port "$POSTGRES_PORT" \
  --mailpit-port "$MAILPIT_PORT"

echo "artifact: baseplate up"
"$CLI" up

cd "$ROOT"
echo "artifact: acceptance against the installed package"
BASEPLATE_CLI="$CLI" \
  BASEPLATE_URL="http://127.0.0.1:$HTTP_PORT" \
  MAILPIT_URL="http://127.0.0.1:$MAILPIT_PORT" \
  npm run test:acceptance

echo "artifact ok"
