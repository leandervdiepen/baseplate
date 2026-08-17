import { DomainError } from "./errors.ts";

const IDENT_RE = /^[a-z][a-z0-9_]*$/;

export type AccessPolicy = {
  readonly table: string;
  readonly ownerColumn: string;
};

export function createAccessPolicy(
  table: string,
  ownerColumn: string,
): AccessPolicy {
  if (!IDENT_RE.test(table)) {
    throw new DomainError(
      "policy.invalid_table",
      "Policy table must be a lowercase identifier.",
    );
  }
  if (!IDENT_RE.test(ownerColumn)) {
    throw new DomainError(
      "policy.invalid_owner_column",
      "Policy owner column must be a lowercase identifier.",
    );
  }
  return { table, ownerColumn };
}
