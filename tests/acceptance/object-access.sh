#!/usr/bin/env bash
# Two users, one bucket, disjoint objects. The same proof two-token.sh makes for
# rows, made for files, because an object is a row with bytes attached.
set -euo pipefail

cd "$(dirname "$0")/../.."
source tests/acceptance/lib.sh

RUN="$(unique)"
BUCKET="acceptance-$RUN"
EMAIL_A="acc-a-$RUN@example.com"
EMAIL_B="acc-b-$RUN@example.com"
PASSWORD="correct horse battery staple"
BODY_A="from-a-$RUN"
BODY_B="from-b-$RUN"

# A fresh Baseplate has no buckets. The operator makes them, exactly like tables.
baseplate storage add-bucket "$BUCKET" >/dev/null
# A run that dies halfway should not leave its bucket behind for the next one.
trap 'baseplate storage rm-bucket "$BUCKET" >/dev/null 2>&1 || true' EXIT

signup() {
  local code
  code="$(auth_post /auth/signup /tmp/baseplate-object-auth.json \
    "{\"email\":\"$1\",\"password\":\"$PASSWORD\"}")"
  if [[ "$code" != "201" ]]; then
    echo "signup answered HTTP $code: $(cat /tmp/baseplate-object-auth.json)" >&2
    exit 1
  fi
  read_field /tmp/baseplate-object-auth.json token
}

put_object() {
  curl -sS -o /dev/null -w "%{http_code}" \
    -X PUT "$BASE/storage/$BUCKET/$2" \
    -H "Authorization: Bearer $1" \
    -H "Content-Type: text/plain" \
    --data-binary "$3"
}

get_object() {
  curl -sS -o /tmp/baseplate-object.txt -w "%{http_code}" \
    "$BASE/storage/$BUCKET/$2" \
    -H "Authorization: Bearer $1"
}

TOKEN_A="$(signup "$EMAIL_A")"
TOKEN_B="$(signup "$EMAIL_B")"
TAMPERED="${TOKEN_A%????}xxxx"

code="$(put_object "$TOKEN_A" "mine.txt" "$BODY_A")"
test "$code" = "201"

code="$(put_object "$TOKEN_B" "theirs.txt" "$BODY_B")"
test "$code" = "201"

# Each reads their own.
code="$(get_object "$TOKEN_A" "mine.txt")"
test "$code" = "200"
test "$(cat /tmp/baseplate-object.txt)" = "$BODY_A"

code="$(get_object "$TOKEN_B" "theirs.txt")"
test "$code" = "200"
test "$(cat /tmp/baseplate-object.txt)" = "$BODY_B"

# Neither reads the other's.
code="$(get_object "$TOKEN_A" "theirs.txt")"
if [[ "$code" != "404" ]]; then
  echo "caller A must not read caller B's object, got HTTP $code"
  exit 1
fi

code="$(get_object "$TOKEN_B" "mine.txt")"
if [[ "$code" != "404" ]]; then
  echo "caller B must not read caller A's object, got HTTP $code"
  exit 1
fi

# A listing shows only your own.
curl -sS "$BASE/storage/$BUCKET" -H "Authorization: Bearer $TOKEN_A" > /tmp/baseplate-list.json
node --input-type=module -e '
import { readFileSync } from "node:fs";
const { objects } = JSON.parse(readFileSync("/tmp/baseplate-list.json", "utf8"));
const [mine, theirs] = process.argv.slice(1);
if (!objects.some((object) => object.key === mine)) {
  throw new Error("caller A did not see their own object");
}
if (objects.some((object) => object.key === theirs)) {
  throw new Error("caller A saw caller B object");
}
' "mine.txt" "theirs.txt"

# Taking someone else's key must not destroy what is behind it.
code="$(put_object "$TOKEN_B" "mine.txt" "overwritten-by-b")"
if [[ "$code" != "409" ]]; then
  echo "caller B must not take caller A's key, got HTTP $code"
  exit 1
fi
code="$(get_object "$TOKEN_A" "mine.txt")"
test "$code" = "200"
if [[ "$(cat /tmp/baseplate-object.txt)" != "$BODY_A" ]]; then
  echo "caller A's bytes were changed by a refused write"
  exit 1
fi

# No token and a broken token get nothing.
code="$(curl -sS -o /dev/null -w "%{http_code}" "$BASE/storage/$BUCKET/mine.txt")"
if [[ "$code" -lt 400 ]]; then
  echo "missing token must get nothing, got HTTP $code"
  exit 1
fi

code="$(curl -sS -o /dev/null -w "%{http_code}" \
  "$BASE/storage/$BUCKET/mine.txt" -H "Authorization: Bearer $TAMPERED")"
if [[ "$code" -lt 400 ]]; then
  echo "tampered token must get nothing, got HTTP $code"
  exit 1
fi

echo "acceptance ok: two users, disjoint objects, missing and tampered rejected"
