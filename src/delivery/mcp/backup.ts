import { DomainError } from "#domain";
import type { Operator } from "#infrastructure";
import { asNumber, objectArgs, ok, requireConfirm, requireString, type ToolResult } from "./helpers.ts";

export async function handleBackup(operator: Operator, params: unknown): Promise<ToolResult> {
  const args = objectArgs(params);
  const command = requireString(args, "command", "mcp.backup_command", "backup needs command.");
  if (command === "list") {
    return ok(await operator.backups.list());
  }
  if (command === "drills") {
    return ok(await operator.backups.drills());
  }
  if (command === "now" || command === "drill") {
    return ok(await operator.backups.run(command === "now" ? "backup" : "drill"));
  }
  throw new DomainError("cli.unknown_backup_command", `Unknown backup command '${command}'.`);
}

export async function handleRestore(operator: Operator, params: unknown): Promise<ToolResult> {
  const args = objectArgs(params);
  requireConfirm(args, "restore");
  return ok(await operator.backups.restore(asNumber(args, "id")));
}
