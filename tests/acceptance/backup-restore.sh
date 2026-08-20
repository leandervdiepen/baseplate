#!/usr/bin/env bash
# The recovery path, walked instead of described.
#
# A backup is taken, sealed, stored and recorded; a row that was in it is then
# deliberately destroyed; the restore puts it back over the live database; and
# the database that comes back still answers HTTP with row access intact. The
# seal is proven by the round trip: the dump is opened with BACKUP_KEY on the
# way out, so a restore that works is a backup that was really encrypted.
set -euo pipefail

cd "$(dirname "$0")/../.."
source tests/acceptance/lib.sh

RUN="$(unique)"
SUB_A="33333333-3333-4333-8333-333333333333"
SUB_B="44444444-4444-4444-8444-444444444444"
EMAIL="restore-$RUN@example.com"
PASSWORD="correct horse battery staple"
# In the backup, so it must come back.
KEPT="kept-$RUN"
# Written after the backup, so it must not. A restore that changed nothing would
# pass on KEPT alone; this is the half that says the rewind was real.
LOST="lost-$RUN"

./scripts/dev schema add-table restore_probe --column body:text >/dev/null 2>&1 || true

TOKEN_A="$(./scripts/dev mint-token --sub "$SUB_A")"
TOKEN_B="$(./scripts/dev mint-token --sub "$SUB_B")"

post_probe() {
  curl -sS -o /dev/null -w "%{http_code}" \
    -X POST "$BASE/restore_probe" \
    -H "Authorization: Bearer $1" \
    -H "Content-Type: application/json" \
    -d "{\"body\":\"$2\"}"
}

get_probe() {
  curl -sS -o /tmp/baseplate-restore-rows.json -w "%{http_code}" \
    "$BASE/restore_probe" \
    -H "Authorization: Bearer $1"
}

# $2 must be among the bodies this caller can see, $3 must not. Either may be
# empty, which means "do not care".
assert_probe() {
  node --input-type=module -e '
import { readFileSync } from "node:fs";
const rows = JSON.parse(readFileSync("/tmp/baseplate-restore-rows.json", "utf8"));
const [who, wanted, unwanted] = process.argv.slice(1);
if (!Array.isArray(rows)) {
  throw new Error(who + " did not get a list of rows");
}
if (wanted && !rows.some((row) => row.body === wanted)) {
  throw new Error(who + " cannot see " + wanted);
}
if (unwanted && rows.some((row) => row.body === unwanted)) {
  throw new Error(who + " can see " + unwanted);
}
' "$1" "$2" "$3"
}

# Yesterday's rows are not this run's business, and leaving them would grow the
# dump a little on every run. Row security means this can only ever reach A's.
code="$(curl -sS -o /dev/null -w "%{http_code}" \
  -X DELETE "$BASE/restore_probe?owner_id=eq.$SUB_A" \
  -H "Authorization: Bearer $TOKEN_A")"
test "$code" = "204"

code="$(post_probe "$TOKEN_A" "$KEPT")"
test "$code" = "201"
code="$(get_probe "$TOKEN_A")"
test "$code" = "200"
assert_probe "caller A" "$KEPT" ""

# A real account, made before the backup, so the restore has to bring the users
# back too and not only the operator's own tables.
code="$(auth_post /auth/signup /tmp/baseplate-restore-signup.json \
  "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")"
if [[ "$code" != "201" ]]; then
  echo "signup answered HTTP $code: $(cat /tmp/baseplate-restore-signup.json)"
  exit 1
fi

# `backup now` returns when the service has written the outcome down, so there
# is nothing to poll for: either the sealed dump reached the destination and was
# recorded, or this exits non-zero.
./scripts/dev backup now > /tmp/baseplate-restore-backup.txt
KEY="$(sed -n 's/^Backed up as \(db\/.*\.dump\.enc\)\.$/\1/p' /tmp/baseplate-restore-backup.txt)"
if [[ -z "$KEY" ]]; then
  echo "backup now did not report a sealed dump: $(cat /tmp/baseplate-restore-backup.txt)"
  exit 1
fi

# The newest thing in the record is the backup just taken, and it is not a
# failure. `backup list` prints id, when, size, destination.
./scripts/dev backup list | head -1 > /tmp/baseplate-restore-list.txt
if grep -q "failed:" /tmp/baseplate-restore-list.txt; then
  echo "the newest backup is a failure: $(cat /tmp/baseplate-restore-list.txt)"
  exit 1
fi
BACKUP_ID="$(awk '{print $1}' /tmp/baseplate-restore-list.txt)"
if [[ ! "$BACKUP_ID" =~ ^[0-9]+$ ]]; then
  echo "no backup id in: $(cat /tmp/baseplate-restore-list.txt)"
  exit 1
fi

code="$(post_probe "$TOKEN_A" "$LOST")"
test "$code" = "201"

# Destroy what the backup holds, and check it is really gone before restoring.
# Restoring over data that is still there proves nothing.
code="$(curl -sS -o /dev/null -w "%{http_code}" \
  -X DELETE "$BASE/restore_probe?body=eq.$KEPT" \
  -H "Authorization: Bearer $TOKEN_A")"
test "$code" = "204"
code="$(get_probe "$TOKEN_A")"
test "$code" = "200"
assert_probe "caller A" "" "$KEPT"

# Destructive, and it asks for the project's name unless there is nobody to ask,
# which is what --yes is for. By id rather than by "the newest", so that what
# comes back is provably the dump this run made and not one that arrived since.
./scripts/dev restore "$BACKUP_ID" --yes > /tmp/baseplate-restore-out.txt
if ! grep -qF "Restored $KEY" /tmp/baseplate-restore-out.txt; then
  echo "restore did not put back $KEY: $(cat /tmp/baseplate-restore-out.txt)"
  exit 1
fi

# Every table is dropped and rebuilt under the live connections, so the API
# needs a moment to find its feet again. That is recovery, not flakiness.
code=""
for _ in $(seq 1 60); do
  code="$(get_probe "$TOKEN_A")"
  if [[ "$code" == "200" ]]; then
    break
  fi
  sleep 1
done
if [[ "$code" != "200" ]]; then
  echo "the API did not come back after the restore, last HTTP $code"
  exit 1
fi

# The row is back, and everything written after the backup is gone with it.
assert_probe "caller A" "$KEPT" "$LOST"

# The restored database is still a database with row access on it. A second
# caller sees none of it, exactly as before.
code="$(get_probe "$TOKEN_B")"
test "$code" = "200"
assert_probe "caller B" "" "$KEPT"

# The account made before the backup can still sign in, so auth came back whole.
code="$(auth_post /auth/login /tmp/baseplate-restore-login.json \
  "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")"
if [[ "$code" != "200" ]]; then
  echo "login after the restore answered HTTP $code: $(cat /tmp/baseplate-restore-login.json)"
  exit 1
fi

echo "backup-restore ok: sealed, stored, restored, and row access still holds"
