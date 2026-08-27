import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, readdir, rm, stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { dirname, join } from "node:path";
import { createS3 } from "../../shared/s3.ts";

export type StoredBackup = {
  key: string;
  bytes: number;
};

/**
 * Where sealed backups go. A bucket the operator names is the real answer: a
 * backup on the same disk as the database is not one. A local directory is the
 * default so a first run produces something, and the studio says it is not off
 * the machine.
 */
export type Destination = {
  readonly label: string;
  readonly offMachine: boolean;
  put(key: string, file: string): Promise<void>;
  fetch(key: string, file: string): Promise<void>;
  list(prefix: string): Promise<StoredBackup[]>;
  remove(key: string): Promise<void>;
};

export type S3Settings = {
  endpoint: string;
  bucket: string;
  region: string;
  accessKey: string;
  secretKey: string;
};

export function localDestination(root: string): Destination {
  const path = (key: string) => join(root, key);
  return {
    label: `this machine (${root})`,
    offMachine: false,
    async put(key, file) {
      await mkdir(dirname(path(key)), { recursive: true });
      await pipeline(createReadStream(file), createWriteStream(path(key)));
    },
    async fetch(key, file) {
      await pipeline(createReadStream(path(key)), createWriteStream(file));
    },
    async list(prefix) {
      const found: StoredBackup[] = [];
      const walk = async (dir: string, base: string): Promise<void> => {
        let entries;
        try {
          entries = await readdir(dir, { withFileTypes: true });
        } catch {
          return;
        }
        for (const entry of entries) {
          const key = base ? `${base}/${entry.name}` : entry.name;
          if (entry.isDirectory()) {
            await walk(join(dir, entry.name), key);
          } else if (key.startsWith(prefix)) {
            found.push({ key, bytes: (await stat(join(dir, entry.name))).size });
          }
        }
      };
      await walk(root, "");
      return found;
    },
    async remove(key) {
      await rm(path(key), { force: true });
    },
  };
}

export function s3Destination(settings: S3Settings): Destination {
  const s3 = createS3(settings);
  return {
    label: `${settings.bucket} at ${new URL(settings.endpoint).host}`,
    offMachine: true,
    async put(key, file) {
      await s3.put(key, webStream(createReadStream(file)), "application/octet-stream");
    },
    async fetch(key, file) {
      const response = await s3.get(key);
      if (!response?.body) {
        throw new Error(`'${key}' is not in the backup bucket.`);
      }
      await pipeline(nodeStream(response.body), createWriteStream(file));
    },
    async list(prefix) {
      return (await s3.list(prefix)).map((object) => ({ key: object.key, bytes: object.size }));
    },
    remove(key) {
      return s3.delete(key);
    },
  };
}

/**
 * Node's web streams and the DOM's are the same objects with two sets of
 * declarations. These two crossings are where that shows, and a backup streams
 * rather than being read into memory, so it is worth the cast.
 */
function webStream(source: Readable): ReadableStream<Uint8Array> {
  return Readable.toWeb(source) as unknown as ReadableStream<Uint8Array>;
}

function nodeStream(body: ReadableStream<Uint8Array>): Readable {
  return Readable.fromWeb(body as never);
}

/**
 * The bucket credentials do cross to the server, unlike the operator's Hetzner
 * account token, because the backup runs there. They are scoped to one bucket
 * and that difference is deliberate.
 */
export function destinationFromEnv(env: NodeJS.ProcessEnv, localRoot: string): Destination {
  const endpoint = env.BACKUP_S3_ENDPOINT;
  const bucket = env.BACKUP_S3_BUCKET;
  const accessKey = env.BACKUP_S3_ACCESS_KEY;
  const secretKey = env.BACKUP_S3_SECRET_KEY;
  if (endpoint && bucket && accessKey && secretKey) {
    return s3Destination({
      endpoint,
      bucket,
      accessKey,
      secretKey,
      region: env.BACKUP_S3_REGION || "us-east-1",
    });
  }
  return localDestination(localRoot);
}
