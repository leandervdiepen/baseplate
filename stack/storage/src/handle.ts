import type { IncomingMessage, ServerResponse } from "node:http";
import { Readable } from "node:stream";
import { jwtVerify } from "jose";
import type { BlobStore } from "./blobs.ts";
import { ObjectConflict, type StorageDb, type StoredObject } from "./db.ts";
import { checkObjectUrl, signObjectUrl } from "./sign.ts";

export type StorageConfig = {
  db: StorageDb;
  blobs: BlobStore;
  secret: Uint8Array;
  /** The raw JWT secret, used to sign object URLs a browser can follow. */
  urlSecret: string;
  maxBytes: number;
};

type Target = { bucket: string; key: string };

export async function handleStorageRequest(
  config: StorageConfig,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const url = new URL(req.url ?? "/", "http://127.0.0.1");
  const path = url.pathname.replace(/^\/storage/, "") || "/";
  const method = req.method ?? "GET";

  if (path === "/health" && method === "GET") {
    sendJson(res, 200, { ok: true });
    return;
  }

  const segments = path.split("/").filter((part) => part.length > 0).map(decodeURIComponent);
  const bucketName = segments[0];
  if (!bucketName) {
    sendJson(res, 404, { code: "storage.not_found", message: "Name a bucket." });
    return;
  }
  const bucket = await config.db.bucket(bucketName);
  if (!bucket) {
    sendJson(res, 404, {
      code: "storage.no_such_bucket",
      message: `There is no bucket called '${bucketName}'. The operator makes buckets.`,
    });
    return;
  }

  // A signed link is the only way a browser can put a private object in an
  // <img>, so it is checked before the Authorization header is looked for.
  const signed = url.searchParams.get("token");
  const key = segments.slice(1).join("/");
  if (method === "GET" && key && signed) {
    await sendSigned(config, bucketName, key, signed, res);
    return;
  }

  const callerId = await readCaller(config, req);
  if (!callerId) {
    sendJson(res, 401, { code: "storage.unauthorized", message: "Sign in first." });
    return;
  }

  if (!key) {
    if (method === "GET") {
      await listObjects(config, callerId, bucketName, url, res);
      return;
    }
    sendJson(res, 405, { code: "storage.method", message: `Cannot ${method} a bucket.` });
    return;
  }

  const target = { bucket: bucketName, key };
  if (method === "PUT" || method === "POST") {
    await upload(config, callerId, target, req, res);
    return;
  }
  if (method === "GET" || method === "HEAD") {
    await download(config, callerId, target, method, res);
    return;
  }
  if (method === "DELETE") {
    await remove(config, callerId, target, res);
    return;
  }
  if (method === "PATCH") {
    await sign(config, callerId, target, url, res);
    return;
  }
  sendJson(res, 405, { code: "storage.method", message: `Cannot ${method} an object.` });
}

async function upload(
  config: StorageConfig,
  callerId: string,
  target: Target,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const declared = Number(req.headers["content-length"] ?? "0");
  if (declared > config.maxBytes) {
    sendJson(res, 413, {
      code: "storage.too_large",
      message: `That file is larger than this stack allows (${config.maxBytes} bytes).`,
    });
    return;
  }
  const contentType = String(req.headers["content-type"] ?? "application/octet-stream");
  try {
    const stored = await config.db.claim(
      callerId,
      target.bucket,
      target.key,
      contentType,
      async () => {
        const { stream, size } = measured(req, config.maxBytes);
        await config.blobs.put(target.bucket, target.key, stream, contentType);
        return size();
      },
    );
    sendJson(res, 201, { object: describe(stored) });
  } catch (error) {
    if (error instanceof ObjectConflict) {
      sendJson(res, 409, { code: "storage.key_taken", message: error.message });
      return;
    }
    if (error instanceof TooLarge) {
      sendJson(res, 413, {
        code: "storage.too_large",
        message: `That file is larger than this stack allows (${config.maxBytes} bytes).`,
      });
      return;
    }
    throw error;
  }
}

async function download(
  config: StorageConfig,
  callerId: string,
  target: Target,
  method: string,
  res: ServerResponse,
): Promise<void> {
  const row = await config.db.find(callerId, target.bucket, target.key);
  if (!row) {
    sendJson(res, 404, { code: "storage.not_found", message: "No such object." });
    return;
  }
  await streamOut(config, target, row, method === "HEAD", res);
}

async function sendSigned(
  config: StorageConfig,
  bucket: string,
  key: string,
  token: string,
  res: ServerResponse,
): Promise<void> {
  const check = checkObjectUrl(config.urlSecret, bucket, key, token, Math.floor(Date.now() / 1000));
  if (!check.ok) {
    sendJson(res, check.reason === "expired" ? 410 : 403, {
      code: `storage.link_${check.reason}`,
      message: check.reason === "expired" ? "That link has expired." : "That link is not valid.",
    });
    return;
  }
  const response = await config.blobs.get(bucket, key);
  if (!response?.body) {
    sendJson(res, 404, { code: "storage.not_found", message: "No such object." });
    return;
  }
  res.writeHead(200, {
    "content-type": response.headers.get("content-type") ?? "application/octet-stream",
    "cache-control": "private, max-age=60",
  });
  await pipe(response, res);
}

async function streamOut(
  config: StorageConfig,
  target: Target,
  row: StoredObject,
  headOnly: boolean,
  res: ServerResponse,
): Promise<void> {
  if (headOnly) {
    res.writeHead(200, {
      "content-type": row.contentType,
      "content-length": String(row.bytes),
    });
    res.end();
    return;
  }
  const response = await config.blobs.get(target.bucket, target.key);
  if (!response?.body) {
    // The row says it is there and the bytes are not. Say so rather than
    // pretending the object never existed.
    sendJson(res, 502, {
      code: "storage.blob_missing",
      message: "That object's bytes are missing from the blob store.",
    });
    return;
  }
  res.writeHead(200, {
    "content-type": row.contentType,
    "content-length": String(row.bytes),
    "cache-control": "private, max-age=60",
  });
  await pipe(response, res);
}

async function listObjects(
  config: StorageConfig,
  callerId: string,
  bucket: string,
  url: URL,
  res: ServerResponse,
): Promise<void> {
  const limit = Math.min(Number(url.searchParams.get("limit") ?? "100") || 100, 1000);
  const offset = Math.max(Number(url.searchParams.get("offset") ?? "0") || 0, 0);
  const prefix = url.searchParams.get("prefix") ?? "";
  const rows = await config.db.list(callerId, bucket, prefix, limit, offset);
  sendJson(res, 200, { objects: rows.map(describe) });
}

async function remove(
  config: StorageConfig,
  callerId: string,
  target: Target,
  res: ServerResponse,
): Promise<void> {
  const removed = await config.db.remove(callerId, target.bucket, target.key);
  if (!removed) {
    sendJson(res, 404, { code: "storage.not_found", message: "No such object." });
    return;
  }
  // The blob goes now; the sweeper is the safety net, not the mechanism.
  await config.blobs.delete(target.bucket, target.key).catch(() => undefined);
  sendJson(res, 200, { ok: true });
}

const MAX_LINK_SECONDS = 7 * 24 * 60 * 60;

async function sign(
  config: StorageConfig,
  callerId: string,
  target: Target,
  url: URL,
  res: ServerResponse,
): Promise<void> {
  const row = await config.db.find(callerId, target.bucket, target.key);
  if (!row) {
    sendJson(res, 404, { code: "storage.not_found", message: "No such object." });
    return;
  }
  const asked = Number(url.searchParams.get("expiresIn") ?? "3600") || 3600;
  const seconds = Math.min(Math.max(asked, 1), MAX_LINK_SECONDS);
  const expiresAt = Math.floor(Date.now() / 1000) + seconds;
  sendJson(res, 200, {
    token: signObjectUrl(config.urlSecret, target.bucket, target.key, expiresAt),
    expiresAt,
  });
}

async function readCaller(
  config: StorageConfig,
  req: IncomingMessage,
): Promise<string | undefined> {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : undefined;
  if (!token) {
    return undefined;
  }
  try {
    const { payload } = await jwtVerify(token, config.secret, { algorithms: ["HS256"] });
    return typeof payload.sub === "string" ? payload.sub : undefined;
  } catch {
    return undefined;
  }
}

class TooLarge extends Error {}

/**
 * The declared content-length is a claim, not a fact, so the bytes are counted
 * as they pass and the upload is cut off if the claim was false.
 */
function measured(
  req: IncomingMessage,
  maxBytes: number,
): { stream: ReadableStream<Uint8Array>; size: () => number } {
  let total = 0;
  const source = Readable.toWeb(req) as ReadableStream<Uint8Array>;
  const stream = source.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        total += chunk.byteLength;
        if (total > maxBytes) {
          throw new TooLarge();
        }
        controller.enqueue(chunk);
      },
    }),
  );
  return { stream, size: () => total };
}

async function pipe(response: Response, res: ServerResponse): Promise<void> {
  const body = response.body;
  if (!body) {
    res.end();
    return;
  }
  const reader = body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    if (!res.write(value)) {
      await new Promise<void>((resolve) => res.once("drain", resolve));
    }
  }
  res.end();
}

function describe(row: StoredObject) {
  return {
    bucket: row.bucket,
    key: row.key,
    bytes: row.bytes,
    contentType: row.contentType,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}
