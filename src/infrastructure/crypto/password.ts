import { randomBytes, scrypt } from "node:crypto";
import { promisify } from "node:util";
import { DomainError } from "#domain";

const scryptAsync = promisify(scrypt);
const KEY_LENGTH = 64;
const SALT_BYTES = 16;
const MIN_LENGTH = 8;
const MAX_LENGTH = 128;

/**
 * Long enough not to be guessed, short enough that scrypt is not a denial of
 * service. Nothing about shape: a rule someone has to work around gets written
 * on a sticky note.
 */
export function assertPassword(password: string): void {
  if (password.length < MIN_LENGTH || password.length > MAX_LENGTH) {
    throw new DomainError(
      "users.weak_password",
      `A password is between ${MIN_LENGTH} and ${MAX_LENGTH} characters.`,
    );
  }
}

/**
 * The same `scrypt:<salt>:<hash>` string the auth service writes and reads
 * (stack/auth/src/password.ts). The operator sets a password directly in the
 * database, so the two have to agree byte for byte; a unit test pins them
 * together rather than trusting that they still do.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const hash = (await scryptAsync(password, salt, KEY_LENGTH)) as Buffer;
  return `scrypt:${salt.toString("base64url")}:${hash.toString("base64url")}`;
}
