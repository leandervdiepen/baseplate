#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/../.."

BASE="${BASEPLATE_URL:-http://127.0.0.1:8080}"
STAMP="$RANDOM"
EMAIL_A="a-$STAMP@example.com"
EMAIL_B="b-$STAMP@example.com"
PASSWORD="a-long-password"
BODY_A="from-a-$STAMP"
BODY_B="from-b-$STAMP"

npx tsx src/delivery/cli/main.ts schema add-table items --column body:text >/dev/null 2>&1 || true

signup() {
  local email="$1"
  curl -sS -o /tmp/baseplate-auth.json -w "%{http_code}" \
    -X POST "$BASE/auth/signup" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$email\",\"password\":\"$PASSWORD\"}"
}

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

code="$(signup "$EMAIL_A")"
test "$code" = "201"
TOKEN_A="$(node --input-type=module -e 'import { readFileSync } from "node:fs"; console.log(JSON.parse(readFileSync("/tmp/baseplate-auth.json","utf8")).token)')"

code="$(signup "$EMAIL_B")"
test "$code" = "201"
TOKEN_B="$(node --input-type=module -e 'import { readFileSync } from "node:fs"; console.log(JSON.parse(readFileSync("/tmp/baseplate-auth.json","utf8")).token)')"

code="$(post_item "$TOKEN_A" "$BODY_A")"
test "$code" = "201"
code="$(post_item "$TOKEN_B" "$BODY_B")"
test "$code" = "201"

code="$(get_items "$TOKEN_A")"
test "$code" = "200"
node --input-type=module -e '
import { readFileSync } from "node:fs";
const rows = JSON.parse(readFileSync("/tmp/baseplate-get.json", "utf8"));
if (!Array.isArray(rows) || !rows.some((row) => row.body === process.argv[1])) {
  throw new Error("caller A missed their row");
}
if (rows.some((row) => row.body === process.argv[2])) {
  throw new Error("caller A saw caller B");
}
' "$BODY_A" "$BODY_B"

code="$(get_items "$TOKEN_B")"
test "$code" = "200"
node --input-type=module -e '
import { readFileSync } from "node:fs";
const rows = JSON.parse(readFileSync("/tmp/baseplate-get.json", "utf8"));
if (!Array.isArray(rows) || !rows.some((row) => row.body === process.argv[1])) {
  throw new Error("caller B missed their row");
}
if (rows.some((row) => row.body === process.argv[2])) {
  throw new Error("caller B saw caller A");
}
' "$BODY_B" "$BODY_A"

echo "signup-login ok"
