import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);
const KEY_LENGTH = 64;

/**
 * A well-formed hash with no preimage. Login verifies against this when the
 * email is unknown, so an unknown address costs the same scrypt work as a real
 * one and the response time stops telling an attacker who has an account.
 *
 * Random per process on purpose: no password can ever verify against it.
 */
export const DUMMY_HASH = `scrypt:${randomBytes(16).toString("base64url")}:${randomBytes(
  KEY_LENGTH,
).toString("base64url")}`;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = (await scryptAsync(password, salt, KEY_LENGTH)) as Buffer;
  return `scrypt:${salt.toString("base64url")}:${hash.toString("base64url")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split(":");
  if (parts.length !== 3 || parts[0] !== "scrypt" || !parts[1] || !parts[2]) {
    return false;
  }
  const salt = Buffer.from(parts[1], "base64url");
  const expected = Buffer.from(parts[2], "base64url");
  const actual = (await scryptAsync(password, salt, KEY_LENGTH)) as Buffer;
  if (actual.length !== expected.length) {
    return false;
  }
  return timingSafeEqual(actual, expected);
}
