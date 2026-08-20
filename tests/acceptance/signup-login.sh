#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/../.."
source tests/acceptance/lib.sh

RUN="$(unique)"
EMAIL_A="a-$RUN@example.com"
EMAIL_B="b-$RUN@example.com"
PASSWORD="a-long-password"
BODY_A="from-a-$RUN"
BODY_B="from-b-$RUN"

./scripts/dev schema add-table items --column body:text >/dev/null 2>&1 || true

signup() {
  auth_post /auth/signup /tmp/baseplate-auth.json \
    "{\"email\":\"$1\",\"password\":\"$PASSWORD\"}"
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
if [[ "$code" != "201" ]]; then
  echo "signup answered HTTP $code: $(cat /tmp/baseplate-auth.json)"
  exit 1
fi
TOKEN_A="$(read_field /tmp/baseplate-auth.json token)"

code="$(signup "$EMAIL_B")"
if [[ "$code" != "201" ]]; then
  echo "signup answered HTTP $code: $(cat /tmp/baseplate-auth.json)"
  exit 1
fi
TOKEN_B="$(read_field /tmp/baseplate-auth.json token)"

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
