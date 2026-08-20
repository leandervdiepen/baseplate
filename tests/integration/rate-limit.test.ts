import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, expect, test } from "vitest";
import { bootStack, downStack, post, readCode, signUp } from "./support/stack.ts";

/**
 * A password spray is the attack the login endpoint actually faces, and the
 * only proof that the limiter is wired in is a burst that hits it. That burst
 * empties a bucket every other file draws from, so it lives alone in this file
 * and calls `post` rather than the retrying `authPost` - nothing here should
 * ride out a 429, it is the thing being measured.
 */
const PASSWORD = "correct horse battery staple";
const EMAIL = `spray-${randomUUID().slice(0, 8)}@example.com`;
/** One more than the per-IP allowance, which is the smaller of the two limits. */
const BURST = 11;

let startedHere = false;

beforeAll(async () => {
  startedHere = await bootStack();
});

beforeAll(async () => {
  // A real account, so the burst is wrong-password attempts against somebody
  // rather than a walk through addresses that do not exist.
  await signUp(EMAIL, PASSWORD);
});

afterAll(async () => {
  await downStack(startedHere);
});

test("a burst of wrong passwords is cut off with 429 and a Retry-After", async () => {
  const { limited, seen } = await sprayUntilLimited();

  // Either limit may be the one that trips - per IP after ten calls, per email
  // after ten within the quarter hour - and the answer is the same either way.
  expect(limited, `no 429 in ${String(seen.length)} attempts: ${seen.join(",")}`).toBeDefined();
  expect(seen.slice(0, -1).every((status) => status === 401)).toBe(true);

  // Without Retry-After a client can only guess, and guessing means hammering.
  const retryAfter = Number(limited?.retryAfter);
  expect(Number.isInteger(retryAfter)).toBe(true);
  expect(retryAfter).toBeGreaterThan(0);
  expect(limited?.code).toBe("auth.rate_limited");
});

/**
 * The limiter is asked before the credentials are, so a throttled caller is
 * throttled full stop. Otherwise a spray that happened to guess right on the
 * eleventh try would still be let in. The bucket drips a token back every few
 * seconds, so this re-empties it rather than assuming the test above left it dry.
 */
test("the right password is refused too while the caller is being throttled", async () => {
  const { limited } = await sprayUntilLimited();
  expect(limited).toBeDefined();

  const response = await post("/auth/login", { email: EMAIL, password: PASSWORD });

  expect(response.status).toBe(429);
  expect(await readCode(response)).toBe("auth.rate_limited");
});

type Limited = { retryAfter: string | null; code: string };

async function sprayUntilLimited(): Promise<{ limited?: Limited; seen: number[] }> {
  const seen: number[] = [];
  for (let attempt = 0; attempt < BURST; attempt += 1) {
    const response = await post("/auth/login", {
      email: EMAIL,
      password: `wrong-${String(attempt)}`,
    });
    seen.push(response.status);
    const retryAfter = response.headers.get("retry-after");
    const code = await readCode(response);
    if (response.status === 429) {
      return { limited: { retryAfter, code }, seen };
    }
  }
  return { seen };
}
