import { expect, test } from "vitest";
import { DUMMY_HASH, hashPassword, verifyPassword } from "../../../stack/auth/src/password.ts";

test("hashPassword then verifyPassword accepts the same secret", async () => {
  const stored = await hashPassword("correct-horse");
  expect(stored.startsWith("scrypt:")).toBe(true);
  expect(await verifyPassword("correct-horse", stored)).toBe(true);
  expect(await verifyPassword("wrong-horse", stored)).toBe(false);
});

/**
 * Guards login's timing fix. If DUMMY_HASH ever stopped being well-formed,
 * verifyPassword would bail on the shape check before doing any scrypt work and
 * an unknown email would answer measurably faster than a real one again.
 */
test("DUMMY_HASH has the shape a real hash has", () => {
  const parts = DUMMY_HASH.split(":");
  expect(parts).toHaveLength(3);
  expect(parts[0]).toBe("scrypt");
  expect(Buffer.from(parts[1] ?? "", "base64url")).toHaveLength(16);
  expect(Buffer.from(parts[2] ?? "", "base64url")).toHaveLength(64);
});

test("nothing verifies against DUMMY_HASH", async () => {
  expect(await verifyPassword("", DUMMY_HASH)).toBe(false);
  expect(await verifyPassword("correct-horse", DUMMY_HASH)).toBe(false);
});

test("a malformed stored hash is refused without pretending to be one", async () => {
  expect(await verifyPassword("anything", "")).toBe(false);
  expect(await verifyPassword("anything", "scrypt:only-two")).toBe(false);
  expect(await verifyPassword("anything", "bcrypt:a:b")).toBe(false);
});
