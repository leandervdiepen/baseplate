import { DomainError } from "./errors.ts";

const IDENT_RE = /^[a-z][a-z0-9_]*$/;
const MAX_IDENT = 63;

/**
 * The types the dashboard may create. Anything outside this list is a migration
 * the operator writes by hand, which keeps generated DDL small and reviewable.
 */
export const COLUMN_TYPES = [
  "text",
  "integer",
  "bigint",
  "numeric",
  "boolean",
  "uuid",
  "timestamptz",
  "date",
  "jsonb",
] as const;

export type ColumnType = (typeof COLUMN_TYPES)[number];

export type Column = {
  readonly name: string;
  readonly type: ColumnType;
  readonly nullable: boolean;
};

export function assertIdentifier(value: string, code: string, subject: string): string {
  if (!IDENT_RE.test(value) || value.length > MAX_IDENT) {
    throw new DomainError(
      code,
      `${subject} must be lowercase letters, digits, and underscores, starting with a letter.`,
    );
  }
  return value;
}

export function isColumnType(value: string): value is ColumnType {
  return (COLUMN_TYPES as readonly string[]).includes(value);
}

export function createColumn(
  name: string,
  type: string,
  nullable: boolean,
): Column {
  assertIdentifier(name, "column.invalid_name", "Column name");
  if (!isColumnType(type)) {
    throw new DomainError(
      "column.unsupported_type",
      `Column type '${type}' is not one of ${COLUMN_TYPES.join(", ")}.`,
    );
  }
  return { name, type, nullable };
}
