import { DomainError } from "./errors.ts";
import type { CallerId } from "./caller-id.ts";

export type TokenClaims = {
  readonly subject: CallerId;
  readonly role: string;
};

export function createTokenClaims(subject: CallerId, role: string): TokenClaims {
  if (!/^[a-z][a-z0-9_]*$/.test(role)) {
    throw new DomainError(
      "token.invalid_role",
      "Token role must be a lowercase identifier.",
    );
  }
  return { subject, role };
}
