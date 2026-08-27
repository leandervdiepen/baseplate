import { DomainError } from "./errors.ts";

const IDENT_RE = /^[a-z][a-z0-9_]*$/;

/**
 * Who may read a table's rows. Writes never change: a row is the owner's,
 * whatever the mode. `private` shows a caller only their own rows, `shared`
 * shows every row to anyone signed in, and `public` drops the token entirely.
 */
export type TableAccess = "private" | "shared" | "public";

export const TABLE_ACCESS: readonly TableAccess[] = ["private", "shared", "public"];

export const DEFAULT_ACCESS: TableAccess = "private";

export type Table = {
  readonly name: string;
  readonly ownerColumn: string;
  readonly access: TableAccess;
};

export function createTable(
  name: string,
  ownerColumn: string,
  access: TableAccess = DEFAULT_ACCESS,
): Table {
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
  return { name, ownerColumn, access };
}

export function isTableAccess(value: string): value is TableAccess {
  return TABLE_ACCESS.includes(value as TableAccess);
}

export function assertTableAccess(value: string): TableAccess {
  if (!isTableAccess(value)) {
    throw new DomainError(
      "table.invalid_access",
      `Access is one of ${TABLE_ACCESS.join(", ")}, not '${value}'.`,
    );
  }
  return value;
}
