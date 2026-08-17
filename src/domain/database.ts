import { DomainError } from "./errors.ts";
import { createTable, type Table } from "./table.ts";

const IDENT_RE = /^[a-z][a-z0-9_]*$/;

export type Database = {
  readonly name: string;
  readonly tables: readonly Table[];
};

export function createDatabase(
  name: string,
  tables: readonly { name: string; ownerColumn: string }[],
): Database {
  if (!IDENT_RE.test(name)) {
    throw new DomainError(
      "database.invalid_name",
      "Database name must be a lowercase identifier.",
    );
  }
  if (tables.length === 0) {
    throw new DomainError(
      "stack.table_required",
      "A stack database must have at least one table.",
    );
  }
  return { name, tables: tables.map((t) => createTable(t.name, t.ownerColumn)) };
}
