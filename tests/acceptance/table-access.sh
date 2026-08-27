#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/../.."
source tests/acceptance/lib.sh

# Widening who may read a table must never widen who may write it. That is the
# whole claim of the three access modes, so it is proved against the product an
# operator installs rather than against the SQL that builds the policies.

SUB_A="11111111-1111-4111-8111-111111111111"
SUB_B="22222222-2222-4222-8222-222222222222"
RUN="$(unique)"

baseplate schema add-table shared_items --column body:text --access shared >/dev/null 2>&1 || true
baseplate schema add-table open_items --column body:text --access public >/dev/null 2>&1 || true

TOKEN_A="$(baseplate mint-token --sub "$SUB_A")"
TOKEN_B="$(baseplate mint-token --sub "$SUB_B")"

insert() {
  local table="$1" token="$2" body="$3"
  curl -sS -o /tmp/baseplate-post.json -w "%{http_code}" \
    -X POST "$BASE/$table" \
    -H "Authorization: Bearer $token" \
    -H "Content-Type: application/json" \
    -H "Prefer: return=representation" \
    -d "{\"body\":\"$body\"}"
}

# Echoes the status code; the body lands in /tmp/baseplate-get.json. No
# Authorization header at all when no token is given, which is the anon role.
select_rows() {
  local table="$1" token="${2:-}"
  if [[ -n "$token" ]]; then
    curl -sS -o /tmp/baseplate-get.json -w "%{http_code}" \
      "$BASE/$table" -H "Authorization: Bearer $token"
  else
    curl -sS -o /tmp/baseplate-get.json -w "%{http_code}" "$BASE/$table"
  fi
}

# Fails unless every named body is in the answer and every denied one is not.
expect_bodies() {
  node --input-type=module -e '
import { readFileSync } from "node:fs";
const [label, present, absent] = process.argv.slice(1);
const rows = JSON.parse(readFileSync("/tmp/baseplate-get.json", "utf8"));
if (!Array.isArray(rows)) {
  throw new Error(`${label}: the answer was not a list of rows`);
}
const bodies = new Set(rows.map((row) => row.body));
for (const body of present.split(",").filter(Boolean)) {
  if (!bodies.has(body)) {
    throw new Error(`${label}: expected to see ${body}`);
  }
}
for (const body of absent.split(",").filter(Boolean)) {
  if (bodies.has(body)) {
    throw new Error(`${label}: must not see ${body}`);
  }
}
' "$@"
}

MINE="shared-a-$RUN"
THEIRS="shared-b-$RUN"

test "$(insert shared_items "$TOKEN_A" "$MINE")" = "201"
# `return=representation` answers with a list of one, so read_field - which
# takes a field off an object - is not the tool for it.
ROW_ID="$(node --input-type=module -e '
  import { readFileSync } from "node:fs";
  process.stdout.write(JSON.parse(readFileSync("/tmp/baseplate-post.json", "utf8"))[0].id);
')"
test "$(insert shared_items "$TOKEN_B" "$THEIRS")" = "201"

# Shared: each caller reads both rows.
test "$(select_rows shared_items "$TOKEN_A")" = "200"
expect_bodies "caller A on a shared table" "$MINE,$THEIRS" ""
test "$(select_rows shared_items "$TOKEN_B")" = "200"
expect_bodies "caller B on a shared table" "$MINE,$THEIRS" ""

# ...and neither writes the other's row, however plainly they can see it.
curl -sS -o /dev/null \
  -X PATCH "$BASE/shared_items?id=eq.$ROW_ID" \
  -H "Authorization: Bearer $TOKEN_B" \
  -H "Content-Type: application/json" \
  -d '{"body":"taken"}'
test "$(select_rows shared_items "$TOKEN_A")" = "200"
expect_bodies "a shared row after a stranger patched it" "$MINE" "taken"

# Shared still means signed in.
code="$(select_rows shared_items)"
if [[ "$code" -lt 400 ]]; then
  echo "a shared table must refuse a caller with no token, got HTTP $code"
  exit 1
fi

# Public: read with no token at all, and still no anonymous write.
PUBLISHED="open-$RUN"
test "$(insert open_items "$TOKEN_A" "$PUBLISHED")" = "201"
test "$(select_rows open_items)" = "200"
expect_bodies "an anonymous read of a public table" "$PUBLISHED" ""

code="$(curl -sS -o /dev/null -w "%{http_code}" \
  -X POST "$BASE/open_items" \
  -H "Content-Type: application/json" \
  -d '{"body":"nobody wrote this"}')"
if [[ "$code" -lt 400 ]]; then
  echo "a public table must refuse an anonymous write, got HTTP $code"
  exit 1
fi

# Narrowing takes the wider read away.
baseplate schema set-access open_items private >/dev/null
code="$(select_rows open_items)"
if [[ "$code" -lt 400 ]]; then
  echo "a table set back to private must refuse an anonymous read, got HTTP $code"
  exit 1
fi

echo "acceptance ok: shared reads all, public reads without a token, neither widens a write"
