import type { Column, SchemaChange, Table } from "#domain";
import { quote } from "./sql.ts";

/** The DDL for a change, as the operator would have written it by hand. */
export function renderChange(change: SchemaChange): string {
  if (change.kind === "create-table") {
    const lines = [
      `  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL`,
      `  ${quote(change.ownerColumn)} uuid NOT NULL`,
      ...change.columns.map((column) => `  ${columnClause(column)}`),
    ];
    return `CREATE TABLE ${quote(change.table)} (\n${lines.join(",\n")}\n);`;
  }
  if (change.kind === "adopt-table") {
    // Nothing to build. The table is already there; this is Baseplate taking
    // responsibility for who can see its rows.
    return "";
  }
  if (change.kind === "drop-table") {
    return `DROP TABLE ${quote(change.table)};`;
  }
  if (change.kind === "rename-table") {
    return `ALTER TABLE ${quote(change.table)} RENAME TO ${quote(change.to)};`;
  }
  if (change.kind === "add-column") {
    return `ALTER TABLE ${quote(change.table)} ADD COLUMN ${columnClause(change.column)};`;
  }
  return `ALTER TABLE ${quote(change.table)} DROP COLUMN ${quote(change.column)};`;
}

/**
 * Row access for the table the change touched. A new table gets its policy in
 * the same transaction as its CREATE, so it is never readable unprotected.
 */
export function policyStatements(
  change: SchemaChange,
  declared: readonly Table[],
): string[] {
  if (change.kind === "drop-table") {
    return [];
  }
  const name = change.kind === "rename-table" ? change.to : change.table;
  const table = declared.find((entry) => entry.name === name);
  if (!table) {
    return [];
  }
  return protectStatements(table);
}

export function protectStatements(table: Table): string[] {
  const name = quote(table.name);
  const owner = quote(table.ownerColumn);
  const policy = quote(`${table.name}_owner`);
  const trigger = quote(`${table.name}_set_owner`);
  const setter = quote(`set_owner_${table.name}`);
  const match = `${owner} = baseplate.caller_id()`;
  return [
    `ALTER TABLE public.${name} ENABLE ROW LEVEL SECURITY`,
    `DROP POLICY IF EXISTS ${policy} ON public.${name}`,
    `CREATE POLICY ${policy} ON public.${name} USING (${match}) WITH CHECK (${match})`,
    `CREATE OR REPLACE FUNCTION baseplate.${setter}() RETURNS trigger
LANGUAGE plpgsql AS $owner$
BEGIN
  NEW.${owner} := baseplate.caller_id();
  RETURN NEW;
END
$owner$`,
    `DROP TRIGGER IF EXISTS ${trigger} ON public.${name}`,
    `CREATE TRIGGER ${trigger} BEFORE INSERT ON public.${name}
       FOR EACH ROW EXECUTE FUNCTION baseplate.${setter}()`,
    `REVOKE ALL ON public.${name} FROM anon`,
    `GRANT SELECT, INSERT, UPDATE, DELETE ON public.${name} TO app_user`,
  ];
}

function columnClause(column: Column): string {
  return `${quote(column.name)} ${column.type}${column.nullable ? "" : " NOT NULL"}`;
}
