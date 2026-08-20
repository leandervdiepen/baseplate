import postgres from "postgres";

export type StoredObject = {
  bucket: string;
  key: string;
  ownerId: string;
  bytes: number;
  contentType: string;
  createdAt: string;
  updatedAt: string;
};

export type Bucket = {
  name: string;
  public: boolean;
};

export class ObjectConflict extends Error {
  constructor(key: string) {
    super(`'${key}' is already taken in this bucket.`);
    this.name = "ObjectConflict";
  }
}

export type StorageDb = ReturnType<typeof connectStorageDb>;

/**
 * Every caller query runs inside a transaction that switches to the caller's
 * own role and claims, so row-level security decides what an object is exactly
 * as it decides what a row is. Nothing here filters by owner in TypeScript.
 */
export function connectStorageDb(config: { password: string }) {
  const sql = postgres({
    host: process.env.POSTGRES_HOST ?? "postgres",
    database: process.env.POSTGRES_DB ?? "app",
    username: "storage_service",
    password: config.password,
    max: 8,
  });

  async function asCaller<T>(
    callerId: string,
    run: (tx: postgres.TransactionSql) => Promise<T>,
  ): Promise<T> {
    return sql.begin(async (tx) => {
      await tx.unsafe("SET LOCAL ROLE app_user").simple();
      await tx`SELECT set_config('request.jwt.claims', ${JSON.stringify({ sub: callerId })}, true)`;
      return run(tx);
    }) as Promise<T>;
  }

  return {
    async bucket(name: string): Promise<Bucket | undefined> {
      const rows = await sql<{ name: string; public: boolean }[]>`
        SELECT name, public FROM storage.buckets WHERE name = ${name}`;
      return rows[0];
    },

    /**
     * Claims the row before a single byte is written, so someone else's key
     * cannot be overwritten by anyone who is not allowed to read it.
     */
    async claim(
      callerId: string,
      bucket: string,
      key: string,
      contentType: string,
      write: () => Promise<number>,
    ): Promise<StoredObject> {
      return asCaller(callerId, async (tx) => {
        // Explicitly mine, not merely visible: in a public bucket someone else's
        // object is readable, and overwriting it must still be refused before
        // any byte is written.
        const mine = await tx<{ key: string }[]>`
          SELECT key FROM storage.objects
          WHERE bucket = ${bucket} AND key = ${key}
            AND owner_id = baseplate.caller_id()
          FOR UPDATE`;
        if (mine.length === 0) {
          try {
            await tx`INSERT INTO storage.objects (bucket, key, owner_id, content_type)
              VALUES (${bucket}, ${key}, baseplate.caller_id(), ${contentType})`;
          } catch (error) {
            if (isUniqueViolation(error)) {
              throw new ObjectConflict(key);
            }
            throw error;
          }
        }
        const bytes = await write();
        const rows = await tx<StorageRow[]>`
          UPDATE storage.objects
          SET bytes = ${bytes}, content_type = ${contentType}, updated_at = now()
          WHERE bucket = ${bucket} AND key = ${key}
          RETURNING bucket, key, owner_id, bytes, content_type, created_at, updated_at`;
        const row = rows[0];
        if (!row) {
          throw new ObjectConflict(key);
        }
        return toObject(row);
      });
    },

    async find(callerId: string, bucket: string, key: string): Promise<StoredObject | undefined> {
      return asCaller(callerId, async (tx) => {
        const rows = await tx<StorageRow[]>`
          SELECT bucket, key, owner_id, bytes, content_type, created_at, updated_at
          FROM storage.objects WHERE bucket = ${bucket} AND key = ${key}`;
        const row = rows[0];
        return row ? toObject(row) : undefined;
      });
    },

    async list(
      callerId: string,
      bucket: string,
      prefix: string,
      limit: number,
      offset: number,
    ): Promise<StoredObject[]> {
      return asCaller(callerId, async (tx) => {
        const rows = await tx<StorageRow[]>`
          SELECT bucket, key, owner_id, bytes, content_type, created_at, updated_at
          FROM storage.objects
          WHERE bucket = ${bucket} AND key LIKE ${`${prefix.replaceAll("%", "\\%")}%`}
          ORDER BY key
          LIMIT ${limit} OFFSET ${offset}`;
        return rows.map(toObject);
      });
    },

    /** Returns false when there was nothing the caller was allowed to remove. */
    async remove(callerId: string, bucket: string, key: string): Promise<boolean> {
      return asCaller(callerId, async (tx) => {
        const rows = await tx<{ key: string }[]>`
          DELETE FROM storage.objects
          WHERE bucket = ${bucket} AND key = ${key} RETURNING key`;
        return rows.length > 0;
      });
    },

    /** Every live key, for the sweeper to compare the blob store against. */
    async liveKeys(): Promise<Set<string>> {
      const rows = await sql<{ bucket: string; key: string }[]>`
        SELECT bucket, key FROM storage.objects`;
      return new Set(rows.map((row) => `${row.bucket}/${row.key}`));
    },

    async close(): Promise<void> {
      await sql.end();
    },
  };
}

type StorageRow = {
  bucket: string;
  key: string;
  owner_id: string;
  bytes: string | number;
  content_type: string;
  created_at: Date;
  updated_at: Date;
};

function toObject(row: StorageRow): StoredObject {
  return {
    bucket: row.bucket,
    key: row.key,
    ownerId: row.owner_id,
    bytes: Number(row.bytes),
    contentType: row.content_type,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "23505";
}
