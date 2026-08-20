import { createS3, type S3Config } from "../../shared/s3.ts";

/**
 * The blob store holds bytes and nothing else. It is on the compose network
 * only, never published and never routed by Caddy, and it is one flat bucket:
 * a Baseplate bucket is a prefix inside it, so making one is a row and not a
 * call over the wire.
 */
export type BlobStore = ReturnType<typeof createBlobStore>;

export function createBlobStore(config: S3Config) {
  const s3 = createS3(config);
  const path = (bucket: string, key: string) => `${bucket}/${key}`;

  return {
    /** Retries, because the blob store is usually still warming up at start. */
    async ready(attempts: number, waitMs: number): Promise<void> {
      for (let attempt = 1; ; attempt += 1) {
        try {
          await s3.ensureBucket();
          return;
        } catch (error) {
          if (attempt >= attempts) {
            throw error;
          }
          await new Promise((resolve) => setTimeout(resolve, waitMs));
        }
      }
    },

    put(bucket: string, key: string, body: BodyInit, contentType: string): Promise<void> {
      return s3.put(path(bucket, key), body, contentType);
    },
    get(bucket: string, key: string): Promise<Response | undefined> {
      return s3.get(path(bucket, key));
    },
    delete(bucket: string, key: string): Promise<void> {
      return s3.delete(path(bucket, key));
    },
    list(prefix: string) {
      return s3.list(prefix);
    },
  };
}
