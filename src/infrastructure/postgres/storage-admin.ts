import postgres from "postgres";
import type { BucketUsage, StorageAdmin, StoredObject } from "#application";
import { createBucket, type Bucket, type BucketVisibility } from "#domain";
import { InfraError } from "#shared";
import type { PostgresAdminConfig } from "./schema-admin.ts";

/**
 * Buckets and object rows are the operator's, in the operator's database, so
 * the operator tool reads and writes them the same way it reads and writes
 * their tables: straight to Postgres over the loopback port.
 *
 * The bytes are not here. They are behind the storage service, and the sweeper
 * removes any blob whose row has gone.
 */
export class PostgresStorageAdmin implements StorageAdmin {
  private readonly sql: postgres.Sql;

  constructor(config: PostgresAdminConfig) {
    this.sql = postgres({
      host: config.host,
      port: config.port,
      database: config.database,
      username: "postgres",
      password: config.password,
      max: 1,
      idle_timeout: 5,
      connect_timeout: 10,
      onnotice: () => undefined,
    });
  }

  async listBuckets(): Promise<readonly Bucket[]> {
    const rows = await this.sql<{ name: string; public: boolean }[]>`
      SELECT name, public FROM storage.buckets ORDER BY name`;
    return rows.map((row) => createBucket(row.name, row.public ? "public" : "private"));
  }

  async createBucket(bucket: Bucket): Promise<void> {
    const rows = await this.sql<{ name: string }[]>`
      INSERT INTO storage.buckets (name, public)
      VALUES (${bucket.name}, ${bucket.visibility === "public"})
      ON CONFLICT (name) DO NOTHING
      RETURNING name`;
    if (rows.length === 0) {
      throw new InfraError(
        "storage.bucket_exists",
        `There is already a bucket called '${bucket.name}'.`,
      );
    }
  }

  async setVisibility(name: string, visibility: BucketVisibility): Promise<void> {
    const rows = await this.sql<{ name: string }[]>`
      UPDATE storage.buckets SET public = ${visibility === "public"}
      WHERE name = ${name} RETURNING name`;
    if (rows.length === 0) {
      throw new InfraError("storage.no_such_bucket", `There is no bucket called '${name}'.`);
    }
  }

  async dropBucket(name: string): Promise<number> {
    return this.sql.begin(async (tx) => {
      const objects = await tx<{ count: string }[]>`
        SELECT count(*)::text AS count FROM storage.objects WHERE bucket = ${name}`;
      const rows = await tx<{ name: string }[]>`
        DELETE FROM storage.buckets WHERE name = ${name} RETURNING name`;
      if (rows.length === 0) {
        throw new InfraError("storage.no_such_bucket", `There is no bucket called '${name}'.`);
      }
      return Number(objects[0]?.count ?? "0");
    }) as Promise<number>;
  }

  async listObjects(bucket: string, limit: number): Promise<readonly StoredObject[]> {
    const rows = await this.sql<
      {
        bucket: string;
        key: string;
        owner_id: string;
        bytes: string;
        content_type: string;
        created_at: Date;
      }[]
    >`
      SELECT bucket, key, owner_id, bytes::text, content_type, created_at
      FROM storage.objects
      WHERE bucket = ${bucket}
      ORDER BY created_at DESC
      LIMIT ${limit}`;
    return rows.map((row) => ({
      bucket: row.bucket,
      key: row.key,
      ownerId: row.owner_id,
      bytes: Number(row.bytes),
      contentType: row.content_type,
      createdAt: row.created_at.toISOString(),
    }));
  }

  async usage(): Promise<readonly BucketUsage[]> {
    const rows = await this.sql<{ bucket: string; objects: string; bytes: string }[]>`
      SELECT b.name AS bucket,
             count(o.key)::text AS objects,
             COALESCE(sum(o.bytes), 0)::text AS bytes
      FROM storage.buckets b
      LEFT JOIN storage.objects o ON o.bucket = b.name
      GROUP BY b.name
      ORDER BY b.name`;
    return rows.map((row) => ({
      bucket: row.bucket,
      objects: Number(row.objects),
      bytes: Number(row.bytes),
    }));
  }

  async close(): Promise<void> {
    await this.sql.end();
  }
}
