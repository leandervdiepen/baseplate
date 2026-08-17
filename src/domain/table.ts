import { DomainError } from "./errors.ts";

const IDENT_RE = /^[a-z][a-z0-9_]*$/;

export type Table = {
  readonly name: string;
  readonly ownerColumn: string;
};

export function createTable(name: string, ownerColumn: string): Table {
  if (!IDENT_RE.test(name)) {
    throw new DomainError(
      "table.invalid_name",
      "Table name must be a lowercase identifier.",
    );
  }
  if (!IDENT_RE.test(ownerColumn)) {
    throw new DomainError(
      "table.invalid_owner_column",
      "Owner column must be a lowercase identifier.",
    );
  }
  return { name, ownerColumn };
}
