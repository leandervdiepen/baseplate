import { DomainError } from "./errors.ts";
import type { CallerId } from "./caller-id.ts";

export type TokenClaims = {
  readonly subject: CallerId;
  readonly role: string;
  /** How long the token is good for. A bearer with no end is not a credential. */
  readonly lifetimeSeconds: number;
};

export function createTokenClaims(
  subject: CallerId,
  role: string,
  lifetimeSeconds: number,
): TokenClaims {
  if (!/^[a-z][a-z0-9_]*$/.test(role)) {
    throw new DomainError(
      "token.invalid_role",
      "Token role must be a lowercase identifier.",
    );
  }
  if (!Number.isInteger(lifetimeSeconds) || lifetimeSeconds <= 0) {
    throw new DomainError(
      "token.invalid_lifetime",
      "A token lifetime is a whole number of seconds, more than zero.",
    );
  }
  return { subject, role, lifetimeSeconds };
}
