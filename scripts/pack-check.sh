#!/usr/bin/env bash
# What an operator downloads, asserted rather than assumed. npm includes a
# nested node_modules that sits inside a directory named in "files", which once
# put 417 files and a macOS-only esbuild binary in the tarball.
set -euo pipefail

cd "$(dirname "$0")/.."

MAX_FILES=600
MAX_UNPACKED_BYTES=$((3 * 1024 * 1024))

REPORT="$(npm pack --dry-run --json 2>/dev/null)"

read -r files unpacked <<<"$(
  printf '%s' "$REPORT" | node -e '
let raw = "";
process.stdin.on("data", (chunk) => (raw += chunk)).on("end", () => {
  const report = JSON.parse(raw)[0];
  process.stdout.write(`${report.entryCount} ${report.unpackedSize}`);
});
'
)"

offenders="$(
  printf '%s' "$REPORT" | node -e '
let raw = "";
process.stdin.on("data", (chunk) => (raw += chunk)).on("end", () => {
  const paths = JSON.parse(raw)[0].files.map((file) => file.path);
  const banned = /(^|\/)node_modules(\/|$)|\.node$|\.tsbuildinfo$|(^|\/)@esbuild(\/|$)|(^|\/)\.DS_Store$/;
  process.stdout.write(paths.filter((path) => banned.test(path)).join("\n"));
});
'
)"

status=0

if [ -n "$offenders" ]; then
  echo "pack-check: these have no business in the tarball:"
  printf '%s\n' "$offenders" | sed 's/^/  /'
  status=1
fi

if [ "$files" -gt "$MAX_FILES" ]; then
  echo "pack-check: $files files, ceiling is $MAX_FILES."
  status=1
fi

if [ "$unpacked" -gt "$MAX_UNPACKED_BYTES" ]; then
  echo "pack-check: $unpacked bytes unpacked, ceiling is $MAX_UNPACKED_BYTES."
  status=1
fi

if [ "$status" -ne 0 ]; then
  echo "pack-check: fix package.json's files list, or raise the ceiling on purpose."
  exit 1
fi

echo "pack-check ok: $files files, $unpacked bytes unpacked."
