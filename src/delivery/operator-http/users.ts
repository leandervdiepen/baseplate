import type { IncomingMessage, ServerResponse } from "node:http";
import { DomainError } from "#domain";
import { createOperatorFor, type OperatorRoots, siteUrlFromEnv } from "../operator-setup.ts";
import { readJsonBody, sendJson } from "./json.ts";

const MAX_LIMIT = 200;

/**
 * People are rows in the operator's database, so the studio reads and writes
 * them through the operator tool, the same way it does buckets and tables. An
 * app signs its own users up through the auth service; this is the other door.
 */
export async function handleUsersRoute(
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
    sendJson(res, 200, { live: false, total: 0, users: [] });
    return;
  }

  try {
    if (path === "/api/users" && method === "GET") {
      const search = url.searchParams.get("search");
      const result = await operator.users.listUsers({
        ...(search ? { search } : {}),
        limit: limitParam(url),
        offset: offsetParam(url),
      });
      sendJson(res, 200, { live: true, total: result.total, users: result.users });
      return;
    }
    if (path === "/api/users" && method === "POST") {
      const body = (await readJsonBody(req)) as {
        email?: string;
        password?: string;
        confirmed?: boolean;
      };
      const user = await operator.users.createUser(
        body.email ?? "",
        body.password ?? "",
        body.confirmed === true,
      );
      sendJson(res, 200, { user });
      return;
    }
    if (path === "/api/users" && method === "DELETE") {
      const removed = await operator.users.deleteUser(url.searchParams.get("id") ?? "");
      if (!removed) {
        sendJson(res, 404, { code: "users.not_found", message: "There is no user with that id." });
        return;
      }
      sendJson(res, 200, { removed: true });
      return;
    }
    if (path === "/api/users/recovery-link" && method === "POST") {
      const id = await requiredId(req);
      sendJson(res, 200, await operator.users.createRecoveryLink(id, siteUrlFromEnv()));
      return;
    }
    if (path === "/api/users/reset-password" && method === "POST") {
      const body = (await readJsonBody(req)) as { id?: string; password?: string };
      if (!body.id) {
        throw new DomainError("users.id_required", "Say which user.");
      }
      await operator.users.setPassword(body.id, body.password ?? "");
      sendJson(res, 200, { ok: true });
      return;
    }
    if (path === "/api/users/revoke-sessions" && method === "POST") {
      const revoked = await operator.users.revokeSessions(await requiredId(req));
      sendJson(res, 200, { revoked });
      return;
    }
    sendJson(res, 404, { code: "operator.not_found", message: "Unknown users route." });
  } finally {
    await operator.users.close();
    await operator.admin.close();
  }
}

async function requiredId(req: IncomingMessage): Promise<string> {
  const body = (await readJsonBody(req)) as { id?: string };
  if (!body.id) {
    throw new DomainError("users.id_required", "Say which user.");
  }
  return body.id;
}

/** A page size, capped so a stray `?limit=1000000` cannot ask for the lot. */
function limitParam(url: URL): number {
  const raw = Number(url.searchParams.get("limit") ?? "");
  if (!Number.isInteger(raw) || raw < 1) {
    return 50;
  }
  return Math.min(raw, MAX_LIMIT);
}

function offsetParam(url: URL): number {
  const raw = Number(url.searchParams.get("offset") ?? "");
  return Number.isInteger(raw) && raw > 0 ? raw : 0;
}
