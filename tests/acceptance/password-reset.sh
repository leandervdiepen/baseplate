#!/usr/bin/env bash
# A forgotten password, start to finish. The reset token never appears in an
# HTTP response, so the dev inbox is the only way through it - which is exactly
# the path a real user takes, and the reason this is worth doing with curl.
set -euo pipefail

cd "$(dirname "$0")/../.."

BASE="${BASEPLATE_URL:-http://127.0.0.1:8080}"
PORT_FROM_ENV="$(sed -n 's/^MAILPIT_UI_PORT=//p' .baseplate/stack.env 2>/dev/null | head -1 || true)"
MAILPIT="${MAILPIT_URL:-http://127.0.0.1:${PORT_FROM_ENV:-8025}}"
EMAIL="reset-$RANDOM-$RANDOM@example.com"
OLD_PASSWORD="correct horse battery staple"
NEW_PASSWORD="a-different-long-password"

post() {
  curl -sS -o "$2" -w "%{http_code}" \
    -X POST "$BASE$1" \
    -H "Content-Type: application/json" \
    -d "$3"
}

read_field() {
  node --input-type=module -e '
    import { readFileSync } from "node:fs";
    const [file, field] = process.argv.slice(1);
    process.stdout.write(String(JSON.parse(readFileSync(file, "utf8"))[field] ?? ""));
  ' "$1" "$2"
}

code="$(post /auth/signup /tmp/baseplate-reset-signup.json \
  "{\"email\":\"$EMAIL\",\"password\":\"$OLD_PASSWORD\"}")"
test "$code" = "201"
REFRESH="$(read_field /tmp/baseplate-reset-signup.json refreshToken)"
test -n "$REFRESH"

# Always 200, whether or not the address has an account. Saying otherwise would
# turn this form into a list of everybody who uses the app.
code="$(post /auth/recover /tmp/baseplate-reset-ask.json "{\"email\":\"$EMAIL\"}")"
test "$code" = "200"

# The send is not awaited - waiting on a mail server would time how long the
# account lookup took - so the mail lands shortly after the 200, not before it.
TOKEN=""
for _ in $(seq 1 40); do
  ID="$(curl -sS --get --data-urlencode "query=to:$EMAIL" "$MAILPIT/api/v1/search" |
    grep -oE '"ID":"[^"]+"' | head -1 | sed 's/.*:"//; s/"$//')"
  if [[ -n "$ID" ]]; then
    TOKEN="$(curl -sS "$MAILPIT/api/v1/message/$ID" |
      grep -oE 'reset-password\?token=[A-Za-z0-9_-]+' | head -1 | sed 's/.*token=//')"
  fi
  if [[ -n "$TOKEN" ]]; then
    break
  fi
  sleep 1
done

if [[ -z "$TOKEN" ]]; then
  echo "no recovery mail for $EMAIL showed up at $MAILPIT"
  exit 1
fi

code="$(post /auth/recover/confirm /tmp/baseplate-reset-confirm.json \
  "{\"token\":\"$TOKEN\",\"password\":\"$NEW_PASSWORD\"}")"
test "$code" = "200"
test -n "$(read_field /tmp/baseplate-reset-confirm.json token)"

# Whoever needed a reset may be recovering from someone else holding the old
# password, so the sessions that password bought die with it.
code="$(post /auth/refresh /tmp/baseplate-reset-refresh.json "{\"refreshToken\":\"$REFRESH\"}")"
if [[ "$code" != "401" ]]; then
  echo "the refresh token from before the reset must be dead, got HTTP $code"
  exit 1
fi

code="$(post /auth/login /tmp/baseplate-reset-new.json \
  "{\"email\":\"$EMAIL\",\"password\":\"$NEW_PASSWORD\"}")"
test "$code" = "200"

code="$(post /auth/login /tmp/baseplate-reset-old.json \
  "{\"email\":\"$EMAIL\",\"password\":\"$OLD_PASSWORD\"}")"
if [[ "$code" != "401" ]]; then
  echo "the old password must not work after a reset, got HTTP $code"
  exit 1
fi

echo "password-reset ok: token read from the inbox, new password in, old one out"
