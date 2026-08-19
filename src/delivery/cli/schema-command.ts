import { DomainError, createSchemaChange, type SchemaChange } from "#domain";

export const SCHEMA_USAGE = `Usage: baseplate schema <command>

  add-table <name> [--column name:type[:null]]...
  drop-table <name>
  rename-table <name> --to <new-name>
  add-column <table> --column name:type   (always optional)
  drop-column <table> --column name`;

export type SchemaArgs = {
  columns: string[];
  to?: string | undefined;
};

/**
 * `title:text` is required, `title:text:null` is nullable. Types are checked by
 * the domain, so an unknown one fails with a code the CLI already prints.
 */
export function parseColumn(raw: string): { name: string; type: string; nullable: boolean } {
  const parts = raw.split(":");
  const name = parts[0] ?? "";
  const type = parts[1] ?? "";
  if (!name || !type) {
    throw new DomainError(
      "cli.invalid_column",
      `--column wants name:type, got '${raw}'.`,
    );
  }
  return { name, type, nullable: parts[2] === "null" };
}

export function schemaChangeFromArgs(
  command: string | undefined,
  target: string | undefined,
  args: SchemaArgs,
): SchemaChange {
  if (!command || !target) {
    throw new DomainError("cli.schema_usage", SCHEMA_USAGE);
  }
  if (command === "add-table") {
    return createSchemaChange({
      kind: "create-table",
      table: target,
      columns: args.columns.map(parseColumn),
    });
  }
  if (command === "drop-table") {
    return createSchemaChange({ kind: "drop-table", table: target });
  }
  if (command === "rename-table") {
    return createSchemaChange({ kind: "rename-table", table: target, to: args.to ?? "" });
  }
  if (command === "add-column" || command === "drop-column") {
    const raw = args.columns[0];
    if (!raw) {
      throw new DomainError("cli.invalid_column", `${command} needs --column.`);
    }
    return createSchemaChange({
      kind: command,
      table: target,
      column: command === "drop-column" ? { name: raw.split(":")[0] ?? "" } : parseColumn(raw),
    });
  }
  throw new DomainError("cli.schema_usage", SCHEMA_USAGE);
}
