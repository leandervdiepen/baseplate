import type { BlobStore } from "./blobs.ts";
import type { StorageDb } from "./db.ts";

/**
 * A blob with no row is a blob nobody can reach. That happens two ways: an
 * object was deleted, and an upload died before its row was committed. Both are
 * the same repair, so there is one loop rather than a tombstone column and a
 * second one.
 *
 * The grace period is what keeps it from deleting an upload still in flight.
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
