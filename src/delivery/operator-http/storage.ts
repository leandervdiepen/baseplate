import type { IncomingMessage, ServerResponse } from "node:http";
import { createOperatorFor, type OperatorRoots } from "../operator-setup.ts";
import { readJsonBody, sendJson } from "./json.ts";

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
    operator = await createOperatorFor(roots, true);
  } catch {
    sendJson(res, 200, { live: false, buckets: [] });
    return;
  }
  const storage = operator.storage;

  try {
    if (path === "/api/storage" && method === "GET") {
      sendJson(res, 200, { live: true, buckets: await storage.buckets() });
      return;
    }
    if (path === "/api/storage" && method === "POST") {
      const body = (await readJsonBody(req)) as { name?: string; visibility?: string };
      await storage.addBucket(body.name ?? "", body.visibility);
      sendJson(res, 200, { live: true, buckets: await storage.buckets() });
      return;
    }
    if (path === "/api/storage" && method === "PATCH") {
      const body = (await readJsonBody(req)) as { name?: string; visibility?: string };
      await storage.setVisibility(body.name ?? "", body.visibility ?? "");
      sendJson(res, 200, { live: true, buckets: await storage.buckets() });
      return;
    }
    if (path === "/api/storage" && method === "DELETE") {
      const removed = await storage.removeBucket(url.searchParams.get("bucket") ?? "");
      sendJson(res, 200, { removed, live: true, buckets: await storage.buckets() });
      return;
    }
    if (path === "/api/storage/objects" && method === "GET") {
      const bucket = url.searchParams.get("bucket") ?? "";
      sendJson(res, 200, { objects: await storage.objects(bucket) });
      return;
    }
    sendJson(res, 404, { code: "operator.not_found", message: "Unknown storage route." });
  } finally {
    await operator.close();
  }
}
