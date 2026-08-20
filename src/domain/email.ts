import { DomainError } from "./errors.ts";

// Deliberately plain: one @, something either side, a dot in the domain. The
// only real test of an address is sending to it, so this catches typos and
// stops nonsense reaching the database, nothing more.
const EMAIL_RE = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

/** What Postgres and every mail server agree an address may weigh. */
const MAX_LENGTH = 254;

export type Email = string & { readonly __brand: "Email" };

/**
 * One spelling per address, so `Ada@Example.com` and `ada@example.com` are the
 * same person however they were typed in.
 */
export function createEmail(raw: string): Email {
  const value = raw.trim().toLowerCase();
  if (value.length > MAX_LENGTH) {
    throw new DomainError(
      "users.invalid_email",
      `An email address is at most ${MAX_LENGTH} characters.`,
    );
  }
  if (!EMAIL_RE.test(value)) {
    throw new DomainError("users.invalid_email", `'${raw}' is not an email address.`);
  }
  return value as Email;
}
