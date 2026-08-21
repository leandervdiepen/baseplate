import type { ManageStorage } from "#application";
import { DomainError } from "#domain";

export const STORAGE_USAGE = `Usage: baseplate storage <command>

  buckets                        List your buckets and what is in them
  add-bucket <name> [--public]   Make a bucket. Private unless you say otherwise
  set-visibility <name> <public|private>
                                 Change who may read a bucket
  rm-bucket <name>               Delete a bucket and every object in it
  objects <name>                 List what is in a bucket, whoever owns it

An app never makes a bucket. It puts objects in one you made, and only ever
sees its own, exactly like rows.`;

export type StorageArgs = {
  readonly makePublic: boolean;
  readonly yes: boolean;
};

export async function runStorageCommand(
  storage: ManageStorage,
  action: string | undefined,
  positionals: readonly (string | undefined)[],
  args: StorageArgs,
  print: (line: string) => void,
): Promise<void> {
  if (action === undefined || action === "help") {
    print(STORAGE_USAGE);
    return;
  }

  if (action === "buckets") {
    const buckets = await storage.buckets();
    if (buckets.length === 0) {
      print("No buckets yet. `baseplate storage add-bucket avatars` makes one.");
      return;
    }
    for (const bucket of buckets) {
      print(
        `${bucket.name} (${bucket.visibility}): ${bucket.objects} object(s), ${formatBytes(bucket.bytes)}`,
      );
    }
    return;
  }

  const name = positionals[0];
  if (!name) {
    throw new DomainError("cli.bucket_required", `\`storage ${action}\` needs a bucket name.`);
  }

  if (action === "add-bucket") {
    const bucket = await storage.addBucket(name, args.makePublic ? "public" : undefined);
    print(
      bucket.visibility === "public"
        ? `Made '${bucket.name}'. Anyone signed in can read it; only the owner of an object can change it.`
        : `Made '${bucket.name}'. Each caller sees only their own objects.`,
    );
    return;
  }

  if (action === "set-visibility") {
    const bucket = await storage.setVisibility(name, positionals[1] ?? "");
    print(`'${bucket.name}' is now ${bucket.visibility}.`);
    return;
  }

  if (action === "rm-bucket") {
    const removed = await storage.removeBucket(name);
    print(`Removed '${name}' and ${removed} object(s). The bytes go with the next sweep.`);
    return;
  }

  if (action === "objects") {
    const objects = await storage.objects(name);
    if (objects.length === 0) {
      print(`'${name}' is empty.`);
      return;
    }
    for (const object of objects) {
      print(`${object.key}  ${formatBytes(object.bytes)}  ${object.contentType}  ${object.ownerId}`);
    }
    return;
  }

  throw new DomainError(
    "cli.unknown_storage_command",
    `Unknown storage command '${action}'.\n\n${STORAGE_USAGE}`,
  );
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  const units = ["kB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${units[unit]}`;
}
