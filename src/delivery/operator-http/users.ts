import type { IncomingMessage, ServerResponse } from "node:http";
import type { ManageUsers } from "#application";
import { DomainError } from "#domain";
import { createOperatorFor, type OperatorRoots, siteUrlFromEnv } from "../operator-setup.ts";
import { readJsonBody, sendJson } from "./json.ts";

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
    operator = await createOperatorFor(roots, true);
  } catch {
    sendJson(res, 200, { live: false, total: 0, users: [] });
    return;
  }
  const users = operator.users;

  try {
    if (path === "/api/users" && method === "GET") {
      const search = url.searchParams.get("search");
      const limit = url.searchParams.get("limit");
      const offset = url.searchParams.get("offset");
      const result = await users.list({
        ...(search ? { search } : {}),
        ...(limit === null ? {} : { limit: Number(limit) }),
        ...(offset === null ? {} : { offset: Number(offset) }),
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
      const user = await users.create(body.email ?? "", body.password ?? "", body.confirmed === true);
      sendJson(res, 200, { user });
      return;
    }
    if (path === "/api/users" && method === "DELETE") {
      await removeUser(users, url.searchParams.get("id") ?? "", res);
      return;
    }
    if (path === "/api/users/recovery-link" && method === "POST") {
      const id = await requiredId(req);
      sendJson(res, 200, await users.recoveryLink(id, siteUrlFromEnv()));
      return;
    }
    if (path === "/api/users/reset-password" && method === "POST") {
      const body = (await readJsonBody(req)) as { id?: string; password?: string };
      if (!body.id) {
        throw new DomainError("users.id_required", "Say which user.");
      }
      await users.setPassword(body.id, body.password ?? "");
      sendJson(res, 200, { ok: true });
      return;
    }
    if (path === "/api/users/revoke-sessions" && method === "POST") {
      const revoked = await users.revokeSessions(await requiredId(req));
      sendJson(res, 200, { revoked });
      return;
    }
    sendJson(res, 404, { code: "operator.not_found", message: "Unknown users route." });
  } finally {
    await operator.close();
  }
}

/**
 * Whether there was anyone to remove is the use case's rule; which status says
 * so is this surface's, and a missing row is the one case that is not a 400.
 */
async function removeUser(users: ManageUsers, id: string, res: ServerResponse): Promise<void> {
  try {
    await users.remove(id);
  } catch (error) {
    if (error instanceof DomainError && error.code === "users.not_found") {
      sendJson(res, 404, { code: error.code, message: error.message });
      return;
    }
    throw error;
  }
  sendJson(res, 200, { removed: true });
}

async function requiredId(req: IncomingMessage): Promise<string> {
  const body = (await readJsonBody(req)) as { id?: string };
  if (!body.id) {
    throw new DomainError("users.id_required", "Say which user.");
  }
  return body.id;
}
