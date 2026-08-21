import { ManageStorage, type BucketUsage, type StorageAdmin } from "#application";
import { createBucket, type Bucket, type BucketVisibility } from "#domain";
import { expect, test } from "vitest";

class RecordingStorage implements StorageAdmin {
  readonly made: Bucket[] = [];
  readonly changed: { name: string; visibility: BucketVisibility }[] = [];

  constructor(
    private readonly buckets: Bucket[] = [],
    private readonly counts: BucketUsage[] = [],
  ) {}

  async listBuckets(): Promise<readonly Bucket[]> {
    return this.buckets;
  }

  async createBucket(bucket: Bucket): Promise<void> {
    this.made.push(bucket);
  }

  async setVisibility(name: string, visibility: BucketVisibility): Promise<void> {
    this.changed.push({ name, visibility });
  }

  async dropBucket(_name: string): Promise<number> {
    return 3;
  }

  async listObjects(): Promise<readonly []> {
    return [];
  }

  async usage(): Promise<readonly BucketUsage[]> {
    return this.counts;
  }

  async close(): Promise<void> {}
}

test("what a bucket holds comes back with the bucket, as one answer", async () => {
  const storage = new RecordingStorage(
    [createBucket("avatars", "public"), createBucket("receipts")],
    [{ bucket: "avatars", objects: 4, bytes: 2048 }],
  );

  expect(await new ManageStorage({ storage }).buckets()).toEqual([
    { name: "avatars", visibility: "public", objects: 4, bytes: 2048 },
    { name: "receipts", visibility: "private", objects: 0, bytes: 0 },
  ]);
});

/** A bucket nobody has written to yet has no usage row, and is not missing. */
test("a bucket with nothing in it counts as empty rather than dropping out", async () => {
  const storage = new RecordingStorage([createBucket("receipts")], []);

  const buckets = await new ManageStorage({ storage }).buckets();

  expect(buckets).toHaveLength(1);
  expect(buckets[0]?.objects).toBe(0);
});

test("a new bucket is private unless the operator says otherwise", async () => {
  const storage = new RecordingStorage();

  expect(await new ManageStorage({ storage }).addBucket("receipts")).toEqual({
    name: "receipts",
    visibility: "private",
  });
  expect(storage.made).toEqual([{ name: "receipts", visibility: "private" }]);
});

test("a bucket the operator asked to be public is made public", async () => {
  const storage = new RecordingStorage();

  await new ManageStorage({ storage }).addBucket("avatars", "public");

  expect(storage.made).toEqual([{ name: "avatars", visibility: "public" }]);
});

test.for([["addBucket"], ["setVisibility"]] as const)(
  "%s refuses a visibility that is neither, and makes no change",
  async ([method]) => {
    const storage = new RecordingStorage();
    const useCase = new ManageStorage({ storage });

    await expect(
      method === "addBucket"
        ? useCase.addBucket("avatars", "everyone")
        : useCase.setVisibility("avatars", "everyone"),
    ).rejects.toMatchObject({ code: "bucket.invalid_visibility" });

    expect(storage.made).toEqual([]);
    expect(storage.changed).toEqual([]);
  },
);

test("removing a bucket answers how many objects went with it", async () => {
  expect(await new ManageStorage({ storage: new RecordingStorage() }).removeBucket("avatars")).toBe(
    3,
  );
});
