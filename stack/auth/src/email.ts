// The same rule as createEmail in src/domain/email.ts, deliberately: one @,
// something either side, and a domain of non-empty dot-separated labels. Public
// signup here and operator user creation there are two doors to one users
// table, so an address has to get the same answer at both.
// tests/unit/domain/email-compat.test.ts pins the two together.
const EMAIL_RE = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

/** What Postgres and every mail server agree an address may weigh. */
const MAX_LENGTH = 254;

export function normalizeEmail(raw: string): string | undefined {
  const email = raw.trim().toLowerCase();
  if (email.length > MAX_LENGTH || !EMAIL_RE.test(email)) {
    return undefined;
  }
  return email;
}

export function assertPassword(password: string): string | undefined {
  if (password.length < 8) {
    return "Password must be at least 8 characters.";
  }
  if (password.length > 128) {
    return "Password is too long.";
  }
  return undefined;
}
