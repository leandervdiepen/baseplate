import { existsSync, readFileSync } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import { resolve } from "node:path";
import type { LiveTable, SchemaHistoryEntry } from "#application";
import { createSchemaChange, DomainError } from "#domain";
import type { Operator } from "#infrastructure";
import { DEFAULT_ACCESS_TTL, parseTtl } from "../../../stack/shared/ttl.ts";
import { createOperatorFor, type OperatorRoots, stackFromEnv } from "../operator-setup.ts";
import { CONFIG_FILE } from "../paths.ts";
import { proxyAuth, proxyPostgrest } from "./db-proxy.ts";
import { parseEnvMap } from "./env-file.ts";
import { sendError, sendJson, readJsonBody } from "./json.ts";
import { type Problem, problemFrom } from "./problem.ts";
import { inspectAccount } from "./hetzner-account.ts";
import { readStatus } from "./status.ts";
import { handleBackupRoute } from "./backups.ts";
import { handleOverview } from "./overview.ts";
import { dropProject, listProjects, openProject } from "./projects.ts";
import { handleStorageRoute } from "./storage.ts";
import { handleUsersRoute } from "./users.ts";
import { writeLocalFirstRun, writeOperatorEnv } from "./write-env.ts";

/** What the history screen shows without asking for more. */
const HISTORY_PAGE = 50;

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
    if (path === "/api/projects" && method === "GET") {
      await listProjects(root, res);
      return;
    }
    if (path === "/api/project" && method === "POST") {
      await openProject(req, res);
      return;
    }
    if (path === "/api/project" && method === "DELETE") {
      await dropProject(req, res);
      return;
    }
    if (path === "/api/config" && method === "GET") {
      sendJson(res, 200, readConfig(root));
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
      // `stack/` belongs to the package, and the containers may be on a server.
      const text = await withOperator(roots, (operator) => operator.logs.execute());
      sendJson(res, 200, { text });
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
 * operator closes every adapter it built, so a route cannot leak one by
 * forgetting it was there.
 */
async function withOperator<T>(
  roots: OperatorRoots,
  run: (operator: Operator) => Promise<T>,
): Promise<T> {
  const operator = await createOperatorFor(roots, true);
  try {
    return await run(operator);
  } finally {
    await operator.close();
  }
}

/**
 * Reading the schema must never break another screen. The stack may be down, or
 * the target may be set to one whose keys are not filled in yet; neither is an
 * error the operator needs thrown at them while they are looking at Settings.
 */
async function readTables(
  roots: OperatorRoots,
): Promise<{ tables: readonly LiveTable[]; live: boolean; problem?: Problem }> {
  let operator;
  try {
    operator = await createOperatorFor(roots, true);
  } catch (error) {
    return { tables: [], live: false, problem: problemFrom(error) };
  }
  try {
    return { tables: await operator.schema.tables(), live: true };
  } catch (error) {
    return { tables: [], live: false, problem: problemFrom(error) };
  } finally {
    await operator.close();
  }
}

async function readHistory(
  roots: OperatorRoots,
): Promise<{ entries: readonly SchemaHistoryEntry[]; problem?: Problem }> {
  let operator;
  try {
    operator = await createOperatorFor(roots, true);
  } catch (error) {
    return { entries: [], problem: problemFrom(error) };
  }
  try {
    return { entries: await operator.schema.history(HISTORY_PAGE) };
  } catch (error) {
    return { entries: [], problem: problemFrom(error) };
  } finally {
    await operator.close();
  }
}

/**
 * What the studio may write into `baseplate.env`. The list is here rather than
 * open-ended so a request cannot set a key nobody meant to expose.
 */
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
  "CORS_ORIGIN",
  "HTTP_PORT",
  "POSTGRES_PORT",
  "STORAGE_ENDPOINT",
  "STORAGE_BUCKET",
  "STORAGE_REGION",
  "STORAGE_MAX_BYTES",
  "BACKUP_EVERY",
  "DRILL_EVERY",
  "BACKUP_KEEP",
  "BACKUP_S3_ENDPOINT",
  "BACKUP_S3_BUCKET",
  "BACKUP_S3_REGION",
  "BACKUP_S3_ACCESS_KEY",
  "BACKUP_S3_SECRET_KEY",
] as const;

/** Written only when a value is given, never cleared by an empty field. */
const SECRET_KEYS = new Set<string>([
  "HCLOUD_TOKEN",
  "HETZNER_DNS_TOKEN",
  "SMTP_PASS",
  "BACKUP_S3_SECRET_KEY",
]);

async function saveConfig(
  root: string,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const body = (await readJsonBody(req)) as Record<string, string | undefined>;
  writeOperatorEnv(root, configUpdates(body));
  sendJson(res, 200, { ok: true });
}

/**
 * What a save actually changes.
 *
 * A secret left blank means "keep the one you have", because the field it came
 * from shows a placeholder rather than the value. Everything else left blank
 * means "clear it", which is the only way to stop sending backups off-machine
 * once you have started. A key nobody put on the list is ignored either way.
 */
export function configUpdates(body: Record<string, string | undefined>): Record<string, string> {
  const updates: Record<string, string> = {};
  for (const key of CONFIG_KEYS) {
    const value = body[key];
    if (typeof value !== "string") {
      continue;
    }
    if (value.length > 0 || !SECRET_KEYS.has(key)) {
      updates[key] = value;
    }
  }
  return updates;
}

/**
 * The settings as they stand. Secrets answer whether one is stored, never with
 * the value: the studio has no reason to hold a token it is not about to send,
 * and a page that shows one is a page that can leak one.
 */
function readConfig(root: string): {
  values: Record<string, string>;
  secrets: Record<string, boolean>;
} {
  const configPath = resolve(root, CONFIG_FILE);
  const current = existsSync(configPath)
    ? parseEnvMap(readFileSync(configPath, "utf8"))
    : {};
  const values: Record<string, string> = {};
  const secrets: Record<string, boolean> = {};
  for (const key of CONFIG_KEYS) {
    if (SECRET_KEYS.has(key)) {
      secrets[key] = (current[key] ?? "").length > 0;
    } else {
      values[key] = current[key] ?? "";
    }
  }
  return { values, secrets };
}
