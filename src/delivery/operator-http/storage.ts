import type { IncomingMessage, ServerResponse } from "node:http";
import { createBucket, DomainError, isBucketVisibility } from "#domain";
import { createOperatorFor, type OperatorRoots } from "../operator-setup.ts";
import { readJsonBody, sendJson } from "./json.ts";

export type BucketSummary = {
  name: string;
  visibility: "private" | "public";
  objects: number;
  bytes: number;
};

/**
 * Buckets are rows in the operator's database, so the studio reads and writes
 * them exactly the way it reads and writes tables: through the operator tool,
 * never by talking to the stack's storage service.
 */
export async function handleStorageRoute(
  roots: OperatorRoots,
  path: string,
  method: string,
  url: URL,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  // The stack may be down, or a target's keys unfilled. Neither is something to
  // throw at someone who only opened the page.
  let operator;
  try {
    operator = createOperatorFor(roots, true);
  } catch {
    sendJson(res, 200, { live: false, buckets: [] });
    return;
  }

  try {
    if (path === "/api/storage" && method === "GET") {
      sendJson(res, 200, { live: true, buckets: await summarize(operator.storage) });
      return;
    }
    if (path === "/api/storage" && method === "POST") {
      const body = (await readJsonBody(req)) as { name?: string; visibility?: string };
      const visibility = body.visibility ?? "private";
      if (!isBucketVisibility(visibility)) {
        throw new DomainError("bucket.invalid_visibility", "Visibility is public or private.");
      }
      await operator.storage.createBucket(createBucket(body.name ?? "", visibility));
      sendJson(res, 200, { live: true, buckets: await summarize(operator.storage) });
      return;
    }
    if (path === "/api/storage" && method === "PATCH") {
      const body = (await readJsonBody(req)) as { name?: string; visibility?: string };
      const visibility = body.visibility ?? "";
      if (!body.name || !isBucketVisibility(visibility)) {
        throw new DomainError("bucket.invalid_visibility", "Visibility is public or private.");
      }
      await operator.storage.setVisibility(body.name, visibility);
      sendJson(res, 200, { live: true, buckets: await summarize(operator.storage) });
      return;
    }
    if (path === "/api/storage" && method === "DELETE") {
      const name = url.searchParams.get("bucket") ?? "";
      const removed = await operator.storage.dropBucket(name);
      sendJson(res, 200, { removed, live: true, buckets: await summarize(operator.storage) });
      return;
    }
    if (path === "/api/storage/objects" && method === "GET") {
      const bucket = url.searchParams.get("bucket") ?? "";
      sendJson(res, 200, { objects: await operator.storage.listObjects(bucket, 200) });
      return;
    }
    sendJson(res, 404, { code: "operator.not_found", message: "Unknown storage route." });
  } finally {
    await operator.storage.close();
    await operator.admin.close();
  }
}

async function summarize(storage: {
  listBuckets: () => Promise<readonly { name: string; visibility: "private" | "public" }[]>;
  usage: () => Promise<readonly { bucket: string; objects: number; bytes: number }[]>;
}): Promise<BucketSummary[]> {
  const [buckets, usage] = await Promise.all([storage.listBuckets(), storage.usage()]);
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
