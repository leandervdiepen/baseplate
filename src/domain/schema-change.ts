import { assertIdentifier, createColumn, type Column } from "./column.ts";
import { DomainError } from "./errors.ts";
import {
  assertTableAccess,
  createTable,
  DEFAULT_ACCESS,
  type Table,
  type TableAccess,
} from "./table.ts";

/** Tables the stack itself needs. The operator may not drop these. */
const RESERVED_TABLES = new Set(["users", "migrations"]);

export const DEFAULT_OWNER_COLUMN = "owner_id";

export type SchemaChange =
  | {
      readonly kind: "create-table";
      readonly table: string;
      readonly ownerColumn: string;
      readonly access: TableAccess;
      readonly columns: readonly Column[];
    }
  | {
      readonly kind: "adopt-table";
      readonly table: string;
      readonly ownerColumn: string;
      readonly access: TableAccess;
    }
  | { readonly kind: "set-access"; readonly table: string; readonly access: TableAccess }
  | { readonly kind: "drop-table"; readonly table: string }
  | { readonly kind: "rename-table"; readonly table: string; readonly to: string }
  | { readonly kind: "add-column"; readonly table: string; readonly column: Column }
  | { readonly kind: "drop-column"; readonly table: string; readonly column: string };

export type SchemaChangeInput = {
  kind: string;
  table?: string;
  to?: string;
  ownerColumn?: string;
  access?: string;
  column?: { name?: string; type?: string; nullable?: boolean };
  columns?: { name?: string; type?: string; nullable?: boolean }[];
};

export function createSchemaChange(input: SchemaChangeInput): SchemaChange {
  const table = assertIdentifier(
    input.table ?? "",
    "schema.invalid_table",
    "Table name",
  );
  if (input.kind === "create-table") {
    const ownerColumn = assertIdentifier(
      input.ownerColumn || DEFAULT_OWNER_COLUMN,
      "schema.invalid_owner_column",
      "Owner column",
    );
    const columns = (input.columns ?? []).map((column) =>
      createColumn(column.name ?? "", column.type ?? "text", column.nullable ?? false),
    );
    assertNoDuplicates(columns, ownerColumn);
    return { kind: "create-table", table, ownerColumn, access: accessOf(input), columns };
  }
  if (input.kind === "adopt-table") {
    return {
      kind: "adopt-table",
      table,
      ownerColumn: assertIdentifier(
        input.ownerColumn || DEFAULT_OWNER_COLUMN,
        "schema.invalid_owner_column",
        "Owner column",
      ),
      access: accessOf(input),
    };
  }
  if (input.kind === "set-access") {
    return { kind: "set-access", table, access: assertTableAccess(input.access ?? "") };
  }
  if (input.kind === "drop-table") {
    assertNotReserved(table);
    return { kind: "drop-table", table };
  }
  if (input.kind === "rename-table") {
    assertNotReserved(table);
    const to = assertIdentifier(input.to ?? "", "schema.invalid_table", "New table name");
    if (to === table) {
      throw new DomainError("schema.rename_noop", "New table name is the current one.");
    }
    return { kind: "rename-table", table, to };
  }
  if (input.kind === "add-column") {
    const column = input.column ?? {};
    return {
      kind: "add-column",
      table,
      // Always optional. The rows already in the table have no value for it, so
      // NOT NULL without a default is rejected by Postgres the moment a table
      // is anything but empty. Making that depend on the row count would mean
      // the same command works today and fails tomorrow.
      column: createColumn(column.name ?? "", column.type ?? "text", true),
    };
  }
  if (input.kind === "drop-column") {
    const name = assertIdentifier(
      input.column?.name ?? "",
      "schema.invalid_column",
      "Column name",
    );
    return { kind: "drop-column", table, column: name };
  }
  throw new DomainError("schema.unknown_change", `Unknown schema change '${input.kind}'.`);
}

/**
 * The tables that should exist after the change lands. Every table carries its
 * owner column and who may read it, so a new one can never arrive without row
 * access.
 */
export function applySchemaChange(
  current: readonly Table[],
  change: SchemaChange,
): Table[] {
  const tables = current.map((table) => ({ ...table }));
  const named = (name: string) => tables.some((table) => table.name === name);

  if (change.kind === "create-table" || change.kind === "adopt-table") {
    if (named(change.table)) {
      throw new DomainError(
        "schema.table_exists",
        `Table '${change.table}' is already declared.`,
      );
    }
    tables.push({
      name: change.table,
      ownerColumn: change.ownerColumn,
      access: change.access,
    });
  } else {
    if (!named(change.table)) {
      throw new DomainError(
        "schema.unknown_table",
        `Table '${change.table}' is not one Baseplate knows about.`,
      );
    }
    if (change.kind === "drop-table") {
      const index = tables.findIndex((table) => table.name === change.table);
      tables.splice(index, 1);
    }
    if (change.kind === "set-access") {
      const target = tables.find((table) => table.name === change.table);
      if (target) {
        target.access = change.access;
      }
    }
    if (change.kind === "rename-table") {
      if (named(change.to)) {
        throw new DomainError(
          "schema.table_exists",
          `Table '${change.to}' is already declared.`,
        );
      }
      const target = tables.find((table) => table.name === change.table);
      if (target) {
        target.name = change.to;
      }
    }
    if (change.kind === "drop-column") {
      const target = tables.find((table) => table.name === change.table);
      if (target && target.ownerColumn === change.column) {
        throw new DomainError(
          "schema.owner_column_required",
          `'${change.column}' is the owner column for '${change.table}'. Drop the table instead.`,
        );
      }
    }
  }

  return tables.map((table) => createTable(table.name, table.ownerColumn, table.access));
}

export function changeSlug(change: SchemaChange): string {
  if (change.kind === "rename-table") {
    return `rename_${change.table}_to_${change.to}`;
  }
  if (change.kind === "set-access") {
    return `set_access_${change.table}_${change.access}`;
  }
  if (change.kind === "add-column" || change.kind === "drop-column") {
    const column = change.kind === "add-column" ? change.column.name : change.column;
    return `${change.kind.replace("-", "_")}_${change.table}_${column}`;
  }
  return `${change.kind.replace("-", "_")}_${change.table}`;
}

function accessOf(input: SchemaChangeInput): TableAccess {
  return input.access ? assertTableAccess(input.access) : DEFAULT_ACCESS;
}

function assertNotReserved(table: string): void {
  if (RESERVED_TABLES.has(table)) {
    throw new DomainError(
      "schema.reserved_table",
      `'${table}' is reserved by the stack.`,
    );
  }
}

function assertNoDuplicates(columns: readonly Column[], ownerColumn: string): void {
  const seen = new Set([ownerColumn, "id"]);
  for (const column of columns) {
    if (seen.has(column.name)) {
      throw new DomainError(
        "schema.duplicate_column",
        `Column '${column.name}' is declared twice.`,
      );
    }
    seen.add(column.name);
  }
}
