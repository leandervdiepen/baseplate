import { DomainError } from "#domain";
import type { Operator } from "#infrastructure";
import { asNumber, objectArgs, ok, requireConfirm, requireString, type ToolResult } from "./helpers.ts";

const BACKUP_TIMEOUT_MS = 10 * 60_000;

export async function handleBackup(operator: Operator, params: unknown): Promise<ToolResult> {
  const args = objectArgs(params);
  const command = requireString(args, "command", "mcp.backup_command", "backup needs command.");
  if (command === "list") {
    return ok(await operator.backups.list(20));
  }
  if (command === "drills") {
    return ok(await operator.backups.drills(20));
  }
  if (command === "now" || command === "drill") {
    const outcome = await operator.backups.request(
      command === "now" ? "backup" : "drill",
      undefined,
      BACKUP_TIMEOUT_MS,
    );
    if (!outcome.ok) {
      throw new DomainError("backup.failed", outcome.message || "That did not work.");
    }
    return ok(outcome);
  }
  throw new DomainError("cli.unknown_backup_command", `Unknown backup command '${command}'.`);
}

export async function handleRestore(operator: Operator, params: unknown): Promise<ToolResult> {
  const args = objectArgs(params);
  requireConfirm(args, "restore");
  const id = asNumber(args, "id");
  const outcome = await operator.backups.request("restore", id, BACKUP_TIMEOUT_MS);
  if (!outcome.ok) {
    throw new DomainError("backup.restore_failed", outcome.message || "That did not work.");
  }
  return ok(outcome);
}
