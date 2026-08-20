import { expect, test } from "vitest";
import {
  createRateLimiter,
  RATE_POLICIES,
  type RatePolicy,
} from "../../../stack/auth/src/rate-limit.ts";

/** A hand-cranked clock, so the bucket maths is checked and not the wall time. */
function fakeClock(): { now: () => number; advance: (seconds: number) => void } {
  let millis = 1_700_000_000_000;
  return {
    now: () => millis,
    advance: (seconds) => {
      millis += seconds * 1000;
    },
  };
}

const THREE_PER_MINUTE: RatePolicy = { name: "test", limit: 3, windowSeconds: 60 };

test("allows a burst up to the limit and then refuses", () => {
  const clock = fakeClock();
  const limiter = createRateLimiter(clock.now);
  expect(limiter.take(THREE_PER_MINUTE, "a").ok).toBe(true);
  expect(limiter.take(THREE_PER_MINUTE, "a").ok).toBe(true);
  expect(limiter.take(THREE_PER_MINUTE, "a").ok).toBe(true);
  expect(limiter.take(THREE_PER_MINUTE, "a").ok).toBe(false);
});

test("refills one attempt per window slice", () => {
  const clock = fakeClock();
  const limiter = createRateLimiter(clock.now);
  for (let i = 0; i < 3; i += 1) {
    limiter.take(THREE_PER_MINUTE, "a");
  }
  expect(limiter.take(THREE_PER_MINUTE, "a").ok).toBe(false);
  clock.advance(20);
  expect(limiter.take(THREE_PER_MINUTE, "a").ok).toBe(true);
  expect(limiter.take(THREE_PER_MINUTE, "a").ok).toBe(false);
});

test("a full window returns the whole burst", () => {
  const clock = fakeClock();
  const limiter = createRateLimiter(clock.now);
  for (let i = 0; i < 3; i += 1) {
    limiter.take(THREE_PER_MINUTE, "a");
  }
  clock.advance(60);
  expect(limiter.take(THREE_PER_MINUTE, "a").ok).toBe(true);
  expect(limiter.take(THREE_PER_MINUTE, "a").ok).toBe(true);
  expect(limiter.take(THREE_PER_MINUTE, "a").ok).toBe(true);
  expect(limiter.take(THREE_PER_MINUTE, "a").ok).toBe(false);
});

test("retryAfterSeconds says when the next attempt lands", () => {
  const clock = fakeClock();
  const limiter = createRateLimiter(clock.now);
  for (let i = 0; i < 3; i += 1) {
    limiter.take(THREE_PER_MINUTE, "a");
  }
  const verdict = limiter.take(THREE_PER_MINUTE, "a");
  expect(verdict.ok).toBe(false);
  if (verdict.ok) {
    return;
  }
  expect(verdict.retryAfterSeconds).toBe(20);
  clock.advance(verdict.retryAfterSeconds);
  expect(limiter.take(THREE_PER_MINUTE, "a").ok).toBe(true);
});

test("retryAfterSeconds is never zero, so a client always waits", () => {
  const clock = fakeClock();
  const limiter = createRateLimiter(clock.now);
  const fast: RatePolicy = { name: "fast", limit: 100, windowSeconds: 1 };
  for (let i = 0; i < 100; i += 1) {
    limiter.take(fast, "a");
  }
  const verdict = limiter.take(fast, "a");
  expect(verdict.ok).toBe(false);
  if (!verdict.ok) {
    expect(verdict.retryAfterSeconds).toBeGreaterThanOrEqual(1);
  }
});

test("one key running dry leaves the others alone", () => {
  const clock = fakeClock();
  const limiter = createRateLimiter(clock.now);
  for (let i = 0; i < 3; i += 1) {
    limiter.take(THREE_PER_MINUTE, "a");
  }
  expect(limiter.take(THREE_PER_MINUTE, "a").ok).toBe(false);
  expect(limiter.take(THREE_PER_MINUTE, "b").ok).toBe(true);
});

test("two policies never share a bucket for the same key", () => {
  const clock = fakeClock();
  const limiter = createRateLimiter(clock.now);
  const other: RatePolicy = { name: "other", limit: 1, windowSeconds: 60 };
  for (let i = 0; i < 3; i += 1) {
    limiter.take(THREE_PER_MINUTE, "a");
  }
  expect(limiter.take(THREE_PER_MINUTE, "a").ok).toBe(false);
  expect(limiter.take(other, "a").ok).toBe(true);
});

test("shipped policies match the documented numbers", () => {
  expect(RATE_POLICIES.credentialsPerIp).toMatchObject({ limit: 10, windowSeconds: 60 });
  expect(RATE_POLICIES.loginPerEmail).toMatchObject({ limit: 10, windowSeconds: 900 });
  expect(RATE_POLICIES.sendPerEmail).toMatchObject({ limit: 3, windowSeconds: 3600 });
  expect(RATE_POLICIES.sendPerIp).toMatchObject({ limit: 20, windowSeconds: 3600 });
  const names = Object.values(RATE_POLICIES).map((policy) => policy.name);
  expect(new Set(names).size).toBe(names.length);
});
