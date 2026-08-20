import { hashPassword as operatorHash } from "#infrastructure";
import { expect, test } from "vitest";
import {
  hashPassword as stackHash,
  verifyPassword,
} from "../../../stack/auth/src/password.ts";

/**
 * The operator writes a password hash straight into the database and the auth
 * service is the one that reads it. Two implementations of the same format is
 * a thing that drifts, so this pins them together in both directions.
 */
test("a hash the operator writes is one the auth service accepts", async () => {
  const stored = await operatorHash("correct-horse");
  expect(stored.startsWith("scrypt:")).toBe(true);
  expect(stored.split(":")).toHaveLength(3);
  expect(await verifyPassword("correct-horse", stored)).toBe(true);
  expect(await verifyPassword("wrong-horse", stored)).toBe(false);
});

test("a hash the auth service wrote still verifies against its own reader", async () => {
  const stored = await stackHash("correct-horse");
  expect(await verifyPassword("correct-horse", stored)).toBe(true);
});

test("the two write the same shape: 16 byte salt, 64 byte key", async () => {
  const [ours, theirs] = await Promise.all([
    operatorHash("correct-horse"),
    stackHash("correct-horse"),
  ]);
  const lengths = (stored: string) =>
    stored.split(":").slice(1).map((part) => Buffer.from(part, "base64url").length);
  expect(lengths(ours)).toEqual([16, 64]);
  expect(lengths(ours)).toEqual(lengths(theirs));
});
