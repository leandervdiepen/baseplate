import { expect, test } from "vitest";
import { assertPassword, normalizeEmail } from "../../../stack/auth/src/email.ts";

test("normalizeEmail lowercases and rejects junk", () => {
  expect(normalizeEmail("  You@Example.COM ")).toBe("you@example.com");
  expect(normalizeEmail("not-an-email")).toBeUndefined();
});

test("assertPassword enforces a minimum length", () => {
  expect(assertPassword("short")).toBe("Password must be at least 8 characters.");
  expect(assertPassword("long-enough")).toBeUndefined();
});
