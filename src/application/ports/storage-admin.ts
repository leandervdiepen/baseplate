import type { Bucket, BucketVisibility } from "#domain";

export type StoredObject = {
  readonly bucket: string;
  readonly key: string;
  readonly ownerId: string;
  readonly bytes: number;
  readonly contentType: string;
  readonly createdAt: string;
};

export type BucketUsage = {
  readonly bucket: string;
  readonly objects: number;
  readonly bytes: number;
};

/**
 * Buckets are the operator's, like tables: an app puts objects in one and never
 * makes one. The rows live in the operator's database, so this is the only
 * thing that can answer what exists.
 */
export type StorageAdmin = {
  listBuckets(): Promise<readonly Bucket[]>;
  createBucket(bucket: Bucket): Promise<void>;
  setVisibility(name: string, visibility: BucketVisibility): Promise<void>;
  /** Drops the bucket and every object row in it. The sweeper takes the bytes. */
  dropBucket(name: string): Promise<number>;
  /** Every object in a bucket, whoever owns it. The operator sees all of them. */
  listObjects(bucket: string, limit: number): Promise<readonly StoredObject[]>;
  usage(): Promise<readonly BucketUsage[]>;
  close(): Promise<void>;
};
