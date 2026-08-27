import type { SchemaChange } from "#domain";
import { literal, quote } from "./sql.ts";

/**
 * Keeps `baseplate.tables` in step with the change. That table is what the
 * stack reads on every start to decide who can see a row.
 */
export function registryStatements(change: SchemaChange): string[] {
  if (change.kind === "create-table" || change.kind === "adopt-table") {
    return [
      `INSERT INTO baseplate.tables (name, owner_column, access)
       VALUES (${literal(change.table)}, ${literal(change.ownerColumn)},
               ${literal(change.access)})`,
    ];
  }
  if (change.kind === "set-access") {
    return [
      `UPDATE baseplate.tables SET access = ${literal(change.access)}
       WHERE name = ${literal(change.table)}`,
    ];
  }
  if (change.kind === "drop-table") {
    return [`DELETE FROM baseplate.tables WHERE name = ${literal(change.table)}`];
  }
  if (change.kind === "rename-table") {
    return [
      `UPDATE baseplate.tables SET name = ${literal(change.to)} WHERE name = ${literal(change.table)}`,
    ];
  }
  return [];
}

export { literal, quote };
