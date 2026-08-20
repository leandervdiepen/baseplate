import { createBucket, DomainError, isBucketVisibility } from "#domain";
import type { Operator } from "#infrastructure";
import { asBoolean, asString, objectArgs, ok, requireConfirm, requireString, type ToolResult } from "./helpers.ts";

export async function handleStorage(operator: Operator, params: unknown): Promise<ToolResult> {
  const args = objectArgs(params);
  const command = requireString(args, "command", "mcp.storage_command", "storage needs command.");
  if (command === "buckets") {
    const [buckets, usage] = await Promise.all([operator.storage.listBuckets(), operator.storage.usage()]);
    return ok(
      buckets.map((bucket) => {
        const counts = usage.find((entry) => entry.bucket === bucket.name);
        return {
          name: bucket.name,
          visibility: bucket.visibility,
          objects: counts?.objects ?? 0,
          bytes: counts?.bytes ?? 0,
        };
      }),
    );
  }
  const name = requireString(args, "name", "mcp.bucket_required", `storage ${command} needs name.`);
  if (command === "add-bucket") {
    const bucket = createBucket(name, asBoolean(args, "public") ? "public" : "private");
    await operator.storage.createBucket(bucket);
    return ok(bucket);
  }
  if (command === "set-visibility") {
    const visibility = asString(args, "visibility") ?? "";
    if (!isBucketVisibility(visibility)) {
      throw new DomainError("cli.invalid_visibility", "Visibility is public or private.");
    }
    await operator.storage.setVisibility(name, visibility);
    return ok({ name, visibility });
  }
  if (command === "rm-bucket") {
    requireConfirm(args, "rm-bucket");
    return ok({ name, removed: await operator.storage.dropBucket(name) });
  }
  if (command === "objects") {
    return ok(await operator.storage.listObjects(name, 200));
  }
  throw new DomainError("cli.unknown_storage_command", `Unknown storage command '${command}'.`);
}
