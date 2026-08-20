import { createServer } from "node:http";
import { createBlobStore } from "./blobs.ts";
import { connectStorageDb } from "./db.ts";
import { handleStorageRequest } from "./handle.ts";
import { sweepOrphans } from "./sweep.ts";

const port = Number(process.env.PORT ?? "3002");
const jwtSecret = required("JWT_SECRET");
const maxBytes = Number(process.env.STORAGE_MAX_BYTES ?? "26214400");
const sweepEveryMs = Number(process.env.STORAGE_SWEEP_MS ?? "60000");
const graceMs = Number(process.env.STORAGE_SWEEP_GRACE_MS ?? "900000");

if (jwtSecret.length < 32) {
  throw new Error("JWT secret must be at least 32 characters.");
}

const db = connectStorageDb({ password: required("STORAGE_SERVICE_PASSWORD") });
const blobs = createBlobStore({
  endpoint: process.env.STORAGE_ENDPOINT || "http://storage-blobs:8333",
  bucket: process.env.STORAGE_BUCKET || "baseplate",
  region: process.env.STORAGE_REGION || "us-east-1",
  accessKey: required("STORAGE_ACCESS_KEY"),
  secretKey: required("STORAGE_SECRET_KEY"),
});

const config = {
  db,
  blobs,
  secret: new TextEncoder().encode(jwtSecret),
  urlSecret: jwtSecret,
  maxBytes,
};

// The blob store comes up alongside this service, so the bucket is claimed with
// a retry rather than a race. Nothing is served until it is there.
await blobs.ready(60, 1_000);

const server = createServer((req, res) => {
  void handleStorageRequest(config, req, res).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "Unknown error.";
    process.stderr.write(`storage: ${message}\n`);
    if (!res.headersSent) {
      res.writeHead(500, { "content-type": "application/json" });
    }
    res.end(JSON.stringify({ code: "storage.internal", message }));
  });
});

server.listen(port, "0.0.0.0", () => {
  process.stdout.write(`storage listening on ${port} (max ${maxBytes} bytes)\n`);
});

/**
 * A blob with no row is unreachable, so it is removed. Failures here are logged
 * and not fatal: a sweep that could not run is wasted disk, not lost data.
 */
setInterval(() => {
  void sweepOrphans(db, blobs, graceMs, Date.now())
    .then((removed) => {
      if (removed > 0) {
        process.stdout.write(`storage: swept ${removed} orphaned blob(s)\n`);
      }
    })
    .catch((error: unknown) => {
      process.stderr.write(
        `storage: sweep failed: ${error instanceof Error ? error.message : String(error)}\n`,
      );
    });
}, sweepEveryMs).unref();

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing ${name}.`);
  }
  return value;
}
