import { expect, test } from "vitest";
import { hashPassword, verifyPassword } from "../../../stack/auth/src/password.ts";

test("hashPassword then verifyPassword accepts the same secret", async () => {
  const stored = await hashPassword("correct-horse");
  expect(stored.startsWith("scrypt:")).toBe(true);
  expect(await verifyPassword("correct-horse", stored)).toBe(true);
  expect(await verifyPassword("wrong-horse", stored)).toBe(false);
});
