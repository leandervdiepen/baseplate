import {
  createBucket,
  DomainError,
  isBucketVisibility,
  type Bucket,
  type BucketVisibility,
} from "#domain";
import type { StorageAdmin, StoredObject } from "../ports/storage-admin.ts";

export type ManageStorageDeps = {
  storage: StorageAdmin;
};

/** A bucket and what is in it. No caller has ever wanted one without the other. */
export type BucketSummary = {
  readonly name: string;
  readonly visibility: BucketVisibility;
  readonly objects: number;
  readonly bytes: number;
};

/** Enough to see what an app has been writing. This is not a listing API. */
const OBJECT_LIMIT = 200;

/**
 * Buckets are the operator's, like tables: an app puts objects in one and never
 * makes one. Everything an operator can do to them is here, so the CLI, the
 * studio and MCP cannot each decide it differently.
 */
export class ManageStorage {
  private readonly deps: ManageStorageDeps;

  constructor(deps: ManageStorageDeps) {
    this.deps = deps;
  }

  /** What exists, merged with what is in it, as one answer. */
  async buckets(): Promise<readonly BucketSummary[]> {
    const [buckets, usage] = await Promise.all([
      this.deps.storage.listBuckets(),
      this.deps.storage.usage(),
    ]);
    return buckets.map((bucket) => {
      const counts = usage.find((entry) => entry.bucket === bucket.name);
      return {
        name: bucket.name,
        visibility: bucket.visibility,
        objects: counts?.objects ?? 0,
        bytes: counts?.bytes ?? 0,
      };
    });
  }

  /** Private unless the operator says otherwise, whichever surface asked. */
  async addBucket(name: string, visibility?: string): Promise<Bucket> {
    const bucket = createBucket(name, parseVisibility(visibility ?? "private"));
    await this.deps.storage.createBucket(bucket);
    return bucket;
  }

  async setVisibility(name: string, visibility: string): Promise<Bucket> {
    const wanted = parseVisibility(visibility);
    await this.deps.storage.setVisibility(name, wanted);
    return { name, visibility: wanted };
  }

  /** Answers how many object rows went with it. The sweeper takes the bytes. */
  async removeBucket(name: string): Promise<number> {
    return this.deps.storage.dropBucket(name);
  }

  /** Every object in a bucket, whoever owns it. The operator sees all of them. */
  async objects(bucket: string): Promise<readonly StoredObject[]> {
    return this.deps.storage.listObjects(bucket, OBJECT_LIMIT);
  }
}

function parseVisibility(raw: string): BucketVisibility {
  if (!isBucketVisibility(raw)) {
    throw new DomainError("bucket.invalid_visibility", "Visibility is public or private.");
  }
  return raw;
}
