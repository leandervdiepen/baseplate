# shellcheck shell=bash
# Shared by every acceptance script. Sourced from the repo root, never run.
#
# Nothing here asserts anything. It exists so that the scripts assert the
# product's behaviour and not the weather: a rate limit that has nothing to do
# with what is being proven, or two runs that happened to pick the same name.

# Where the stack is. Point the scripts at a server with BASEPLATE_URL.
BASE="${BASEPLATE_URL:-http://127.0.0.1:8080}"

# How long one credential call may spend waiting out a 429 before it gives up
# and says so. The limiter refills one attempt every six seconds, so ninety is
# room for a queue in front of us and no room for a real problem to hide in.
RATE_LIMIT_BUDGET_SECONDS="${RATE_LIMIT_BUDGET_SECONDS:-90}"

# $RANDOM is fifteen bits. Two runs a minute apart pick the same number often
# enough to fail a signup with 409 on an address the previous run already took,
# which reads as a broken product and is not one. Eight bytes from the kernel
# do not collide.
unique() {
  od -An -N8 -tx1 /dev/urandom | tr -d ' \n'
}

# POST to an auth endpoint, writing the body to $2 and echoing the status code.
#
# Credential endpoints allow ten calls a minute per IP. CI runs the integration
# suite against this same stack immediately before these scripts, and the
# scripts run one after another from one address, so a 429 only ever means the
# budget is spent - never that the product is wrong. Waiting it out is the only
# honest reading; asserting against it would be asserting on the clock.
auth_post() {
  local path="$1" out="$2" body="$3"
  local headers="/tmp/baseplate-auth-headers.$$"
  local code wait_s waited=0
  while :; do
    # curl leaves the file alone when it cannot connect at all, and a failure
    # message quoting the last run's body is worse than one quoting nothing.
    : > "$out"
    code="$(curl -sS -o "$out" -D "$headers" -w "%{http_code}" \
      -X POST "$BASE$path" \
      -H "Content-Type: application/json" \
      -d "$body")"
    if [[ "$code" != "429" ]]; then
      rm -f "$headers"
      echo "$code"
      return 0
    fi
    # The limiter says how long it wants; believe it, and fall back to a whole
    # refill interval when something in the middle has eaten or reshaped the
    # header, because a bad number here would sleep for no time or forever.
    wait_s="$(sed -n 's/^[Rr]etry-[Aa]fter: *//p' "$headers" | tr -d '\r' | head -1)"
    if [[ ! "$wait_s" =~ ^[0-9]+$ ]]; then
      wait_s=6
    fi
    if (( waited + wait_s > RATE_LIMIT_BUDGET_SECONDS )); then
      rm -f "$headers"
      echo "POST $path is rate limited ${waited}s in and wants ${wait_s}s more," >&2
      echo "past the ${RATE_LIMIT_BUDGET_SECONDS}s budget. Something is spending" >&2
      echo "credential attempts faster than the limiter refills them." >&2
      exit 1
    fi
    sleep "$wait_s"
    waited=$((waited + wait_s))
  done
}

# One field out of a JSON file. jq is not a thing this repo makes anyone install.
read_field() {
  node --input-type=module -e '
    import { readFileSync } from "node:fs";
    const [file, field] = process.argv.slice(1);
    process.stdout.write(String(JSON.parse(readFileSync(file, "utf8"))[field] ?? ""));
  ' "$1" "$2"
}
