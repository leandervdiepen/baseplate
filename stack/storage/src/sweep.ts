import type { BlobStore } from "./blobs.ts";
import type { StorageDb } from "./db.ts";

/**
 * A blob with no row is unreachable, whether the object was deleted or an upload
 * died before its row committed. One repair for both, and the grace period is
 * what keeps it off an upload still in flight.
 */
export async function sweepOrphans(
  db: StorageDb,
  blobs: BlobStore,
  graceMs: number,
  now: number,
): Promise<number> {
  const live = await db.liveKeys();
  const stored = await blobs.list("");
  let removed = 0;
  for (const object of stored) {
    if (live.has(object.key)) {
      continue;
    }
    if (object.lastModified !== undefined && now - object.lastModified < graceMs) {
      continue;
    }
    const slash = object.key.indexOf("/");
    if (slash <= 0) {
      continue;
    }
    await blobs.delete(object.key.slice(0, slash), object.key.slice(slash + 1));
    removed += 1;
  }
  return removed;
}
