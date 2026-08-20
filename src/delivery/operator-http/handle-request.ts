import type { IncomingMessage, ServerResponse } from "node:http";
import { createSchemaChange, DomainError } from "#domain";
import { DEFAULT_ACCESS_TTL, parseTtl } from "../../../stack/shared/ttl.ts";
import { createOperatorFor, type OperatorRoots, stackFromEnv } from "../operator-setup.ts";
import { proxyAuth, proxyPostgrest } from "./db-proxy.ts";
import { sendError, sendJson, readJsonBody } from "./json.ts";
import { readComposeLogs } from "./logs.ts";
import { inspectAccount } from "./hetzner-account.ts";
import { readStatus } from "./status.ts";
import { handleBackupRoute } from "./backups.ts";
import { handleOverview } from "./overview.ts";
import { handleStorageRoute } from "./storage.ts";
import { handleUsersRoute } from "./users.ts";
import { writeLocalFirstRun, writeOperatorEnv } from "./write-env.ts";

export async function handleOperatorRequest(
  roots: OperatorRoots,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const root = roots.projectRoot;
  try {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    const path = url.pathname;
    const method = req.method ?? "GET";
    if (path === "/api/status" && method === "GET") {
      sendJson(res, 200, await readStatus(root));
      return;
    }

    if (path === "/api/first-run" && method === "POST") {
      const body = (await readJsonBody(req)) as { target?: string };
      if (body.target && body.target !== "local") {
        throw new DomainError(
          "operator.hetzner_needs_domain",
          "Start local. Hetzner needs a domain you already own, and Settings walks through it.",
        );
      }
      writeLocalFirstRun(root);
      sendJson(res, 200, { ok: true, target: "local" });
      return;
    }
    if (path === "/api/hetzner/account" && method === "GET") {
      sendJson(res, 200, await inspectAccount(root));
      return;
    }
    if (path === "/api/config" && method === "POST") {
      await saveConfig(root, req, res);
      return;
    }
    if (path === "/api/provision" && method === "POST") {
      const body = (await readJsonBody(req)) as { replace?: boolean };
      const result = await withOperator(roots, (operator) =>
        operator.provision.execute(stackFromEnv(), { replace: body.replace === true }),
      );
      sendJson(res, 200, result);
      return;
    }
    if (path === "/api/teardown" && method === "POST") {
      const body = (await readJsonBody(req)) as { destroy?: boolean };
      const destroy = body.destroy === true;
      await withOperator(roots, (operator) => operator.teardown.execute({ destroy }));
      sendJson(res, 200, { ok: true, destroyed: destroy });
      return;
    }
    if (path === "/api/mint-token" && method === "POST") {
      const body = (await readJsonBody(req)) as { sub?: string; ttl?: string };
      if (!body.sub) {
        throw new DomainError("cli.sub_required", "mint-token requires sub.");
      }
      const sub = body.sub;
      const ttl = body.ttl ? parseTtl(body.ttl, DEFAULT_ACCESS_TTL) : undefined;
      const token = await withOperator(roots, (operator) => operator.mintToken.execute(sub, ttl));
      sendJson(res, 200, { token, sub });
      return;
    }
    if (path === "/api/schema" && method === "GET") {
      sendJson(res, 200, await readTables(roots));
      return;
    }
    if (path === "/api/schema" && method === "POST") {
      const change = createSchemaChange(
        (await readJsonBody(req)) as Parameters<typeof createSchemaChange>[0],
      );
      const result = await withOperator(roots, (operator) => operator.changeSchema.execute(change));
      sendJson(res, 200, { statement: result.statement, tables: result.tables });
      return;
    }
    if (path === "/api/overview" && method === "GET") {
      await handleOverview(roots, res);
      return;
    }
    if (path.startsWith("/api/backups")) {
      await handleBackupRoute(roots, path, method, req, res);
      return;
    }
    if (path.startsWith("/api/storage")) {
      await handleStorageRoute(roots, path, method, url, req, res);
      return;
    }
    // Before the /api/auth proxy: these are the operator's own routes, not the
    // app's auth service, and /api/users is not under /api/auth by accident.
    if (path.startsWith("/api/users")) {
      await handleUsersRoute(roots, path, method, url, req, res);
      return;
    }
    if (path === "/api/history" && method === "GET") {
      sendJson(res, 200, await readHistory(roots));
      return;
    }
    if (path === "/api/logs" && method === "GET") {
      sendJson(res, 200, { text: await readComposeLogs(root) });
      return;
    }
    if (path.startsWith("/api/auth")) {
      await proxyAuth(root, req, res);
      return;
    }
    if (path.startsWith("/api/db/")) {
      await proxyPostgrest(root, req, res);
      return;
    }
    sendJson(res, 404, { code: "operator.not_found", message: "Unknown operator route." });
  } catch (error) {
    sendError(res, error);
  }
}

/**
 * Every route that opens an operator closes it again, whatever happened. The
 * pools are lazy, so a missed close leaks nothing today; it is one rule rather
 * than a habit that holds until someone adds a route that does connect.
 */
async function withOperator<T>(
  roots: OperatorRoots,
  run: (operator: ReturnType<typeof createOperatorFor>) => Promise<T>,
): Promise<T> {
  const operator = createOperatorFor(roots, true);
  try {
    return await run(operator);
  } finally {
    await operator.admin.close();
    await operator.storage.close();
    await operator.backups.close();
    await operator.users.close();
  }
}

/**
 * Reading the schema must never break another screen. The stack may be down, or
 * the target may be set to one whose keys are not filled in yet; neither is an
 * error the operator needs thrown at them while they are looking at Settings.
 */
async function readTables(roots: OperatorRoots): Promise<unknown> {
  let operator;
  try {
    operator = createOperatorFor(roots, true);
  } catch {
    return { tables: [], live: false };
  }
  try {
    return { tables: await operator.admin.listTables(), live: true };
  } catch {
    return { tables: [], live: false };
  } finally {
    await operator.admin.close();
  }
}

async function readHistory(roots: OperatorRoots): Promise<unknown> {
  let operator;
  try {
    operator = createOperatorFor(roots, true);
  } catch {
    return { entries: [] };
  }
  try {
    return { entries: await operator.admin.history(50) };
  } catch {
    return { entries: [] };
  } finally {
    await operator.admin.close();
  }
}

const CONFIG_KEYS = [
  "TARGET",
  "SITE_ADDRESS",
  "HCLOUD_TOKEN",
  "HETZNER_DNS_TOKEN",
  "HETZNER_DNS_ZONE",
  "SSH_KEY_NAME",
  "SERVER_LOCATION",
  "BASEPLATE_HOSTNAME",
  "ACCESS_TOKEN_TTL",
  "REFRESH_TOKEN_TTL",
  "SITE_URL",
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_USER",
  "SMTP_PASS",
  "SMTP_FROM",
  "SMTP_SECURE",
  "REQUIRE_EMAIL_CONFIRM",
] as const;

async function saveConfig(
  root: string,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const body = (await readJsonBody(req)) as Record<string, string | undefined>;
  const updates: Record<string, string> = {};
  for (const key of CONFIG_KEYS) {
    const value = body[key];
    if (typeof value === "string" && value.length > 0) {
      updates[key] = value;
    }
  }
  writeOperatorEnv(root, updates);
  sendJson(res, 200, { ok: true });
}
