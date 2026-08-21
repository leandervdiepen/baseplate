import { createSchemaChange } from "#domain";
import type { Operator } from "#infrastructure";
import { renderTypes } from "../cli/types-command.ts";
import { asNumber, asString, objectArgs, ok, requireConfirm, requireString, type ToolResult } from "./helpers.ts";

export async function handleTables(operator: Operator): Promise<ToolResult> {
  return ok(await operator.schema.tables());
}

export async function handleTypes(operator: Operator): Promise<ToolResult> {
  return ok(renderTypes(await operator.schema.tables()));
}

export async function handleSchema(operator: Operator, params: unknown): Promise<ToolResult> {
  const args = objectArgs(params);
  const command = requireString(args, "command", "mcp.schema_command", "schema needs command.");
  if (command === "history") {
    return ok(await operator.schema.history(asNumber(args, "limit")));
  }
  if (command === "drop-table" || command === "drop-column") {
    requireConfirm(args, command);
  }
  const table = requireString(args, "table", "mcp.schema_table", `schema ${command} needs table.`);
  const to = asString(args, "to");
  const ownerColumn = asString(args, "owner_column");
  const column = columnFrom(args);
  const result = await operator.changeSchema.execute(
    createSchemaChange({
      kind: command === "add-table" ? "create-table" : command,
      table,
      ...(to ? { to } : {}),
      ...(ownerColumn ? { ownerColumn } : {}),
      ...(column ? { column } : {}),
      columns: columnsFrom(args),
    }),
  );
  return ok({ statement: result.statement, tables: result.tables });
}

function columnsFrom(args: Record<string, unknown>): { name?: string; type?: string; nullable?: boolean }[] {
  if (!Array.isArray(args.columns)) {
    return [];
  }
  return args.columns.map((item) => readColumn(item) ?? {});
}

function columnFrom(
  args: Record<string, unknown>,
): { name?: string; type?: string; nullable?: boolean } | undefined {
  return readColumn(args.column);
}

function readColumn(raw: unknown): { name?: string; type?: string; nullable?: boolean } | undefined {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return undefined;
  }
  const row = raw as Record<string, unknown>;
  return {
    ...(typeof row.name === "string" ? { name: row.name } : {}),
    ...(typeof row.type === "string" ? { type: row.type } : {}),
    ...(row.nullable === true ? { nullable: true } : {}),
  };
}
