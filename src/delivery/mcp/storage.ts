import { DomainError } from "#domain";
import type { Operator } from "#infrastructure";
import { asBoolean, asString, objectArgs, ok, requireConfirm, requireString, type ToolResult } from "./helpers.ts";

export async function handleStorage(operator: Operator, params: unknown): Promise<ToolResult> {
  const args = objectArgs(params);
  const command = requireString(args, "command", "mcp.storage_command", "storage needs command.");
  if (command === "buckets") {
    return ok(await operator.storage.buckets());
  }
  const name = requireString(args, "name", "mcp.bucket_required", `storage ${command} needs name.`);
  if (command === "add-bucket") {
    return ok(await operator.storage.addBucket(name, asBoolean(args, "public") ? "public" : undefined));
  }
  if (command === "set-visibility") {
    return ok(await operator.storage.setVisibility(name, asString(args, "visibility") ?? ""));
  }
  if (command === "rm-bucket") {
    requireConfirm(args, "rm-bucket");
    return ok({ name, removed: await operator.storage.removeBucket(name) });
  }
  if (command === "objects") {
    return ok(await operator.storage.objects(name));
  }
  throw new DomainError("cli.unknown_storage_command", `Unknown storage command '${command}'.`);
}
