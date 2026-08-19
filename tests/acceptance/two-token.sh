#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/../.."

BASE="${BASEPLATE_URL:-http://127.0.0.1:8080}"
SUB_A="11111111-1111-4111-8111-111111111111"
SUB_B="22222222-2222-4222-8222-222222222222"
BODY_A="from-a-$RANDOM"
BODY_B="from-b-$RANDOM"

if [[ ! -f operator.env ]]; then
  cp operator.env.example operator.env
fi

# A fresh Baseplate has no app tables. The operator makes them; nothing in the
# repo declares them. Creating it here is part of what this proves.
npx tsx src/delivery/cli/main.ts schema add-table items --column body:text >/dev/null 2>&1 || true

TOKEN_A="$(npx tsx src/delivery/cli/main.ts mint-token --sub "$SUB_A")"
TOKEN_B="$(npx tsx src/delivery/cli/main.ts mint-token --sub "$SUB_B")"
TAMPERED="${TOKEN_A%????}xxxx"

post_item() {
  local token="$1"
  local body="$2"
  curl -sS -o /tmp/baseplate-post.json -w "%{http_code}" \
    -X POST "$BASE/items" \
    -H "Authorization: Bearer $token" \
    -H "Content-Type: application/json" \
    -H "Prefer: return=representation" \
    -d "{\"body\":\"$body\"}"
}

get_items() {
  local token="$1"
  curl -sS -o /tmp/baseplate-get.json -w "%{http_code}" \
    "$BASE/items" \
    -H "Authorization: Bearer $token"
}

code="$(post_item "$TOKEN_A" "$BODY_A")"
test "$code" = "201"

code="$(post_item "$TOKEN_B" "$BODY_B")"
test "$code" = "201"

code="$(get_items "$TOKEN_A")"
test "$code" = "200"
node --input-type=module -e '
import { readFileSync } from "node:fs";
const rows = JSON.parse(readFileSync("/tmp/baseplate-get.json", "utf8"));
const sub = process.argv[1];
const body = process.argv[2];
const other = process.argv[3];
if (!Array.isArray(rows) || rows.length === 0) {
  throw new Error("caller A got no rows");
}
if (rows.some((row) => row.owner_id !== sub)) {
  throw new Error("caller A saw another caller row");
}
if (!rows.some((row) => row.body === body)) {
  throw new Error("caller A did not see their insert");
}
if (rows.some((row) => row.body === other)) {
  throw new Error("caller A saw caller B body");
}
' "$SUB_A" "$BODY_A" "$BODY_B"

code="$(get_items "$TOKEN_B")"
test "$code" = "200"
node --input-type=module -e '
import { readFileSync } from "node:fs";
const rows = JSON.parse(readFileSync("/tmp/baseplate-get.json", "utf8"));
const sub = process.argv[1];
const body = process.argv[2];
const other = process.argv[3];
if (!Array.isArray(rows) || rows.length === 0) {
  throw new Error("caller B got no rows");
}
if (rows.some((row) => row.owner_id !== sub)) {
  throw new Error("caller B saw another caller row");
}
if (!rows.some((row) => row.body === body)) {
  throw new Error("caller B did not see their insert");
}
if (rows.some((row) => row.body === other)) {
  throw new Error("caller B saw caller A body");
}
' "$SUB_B" "$BODY_B" "$BODY_A"

code="$(curl -sS -o /tmp/baseplate-get.json -w "%{http_code}" "$BASE/items")"
if [[ "$code" -lt 400 ]]; then
  echo "missing token must get nothing, got HTTP $code"
  exit 1
fi

code="$(curl -sS -o /tmp/baseplate-get.json -w "%{http_code}" \
  "$BASE/items" -H "Authorization: Bearer $TAMPERED")"
if [[ "$code" -lt 400 ]]; then
  echo "tampered token must get nothing, got HTTP $code"
  exit 1
fi

echo "acceptance ok: two tokens, disjoint rows, missing and tampered rejected"
