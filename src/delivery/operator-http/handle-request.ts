import type { IncomingMessage, ServerResponse } from "node:http";
import { createSchemaChange, DomainError } from "#domain";
import { createOperatorFromRoot, stackFromEnv } from "../operator-setup.ts";
import { proxyAuth, proxyPostgrest } from "./db-proxy.ts";
import { sendError, sendJson, readJsonBody } from "./json.ts";
import { readComposeLogs } from "./logs.ts";
import { readStatus } from "./status.ts";
import { writeLocalFirstRun, writeOperatorEnv } from "./write-env.ts";

export async function handleOperatorRequest(
  root: string,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
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
    if (path === "/api/config" && method === "POST") {
      await saveConfig(root, req, res);
      return;
    }
    if (path === "/api/provision" && method === "POST") {
      const result = await createOperatorFromRoot(root, true).provision.execute(
        stackFromEnv(),
      );
      sendJson(res, 200, result);
      return;
    }
    if (path === "/api/teardown" && method === "POST") {
      await createOperatorFromRoot(root, true).teardown.execute();
      sendJson(res, 200, { ok: true });
      return;
    }
    if (path === "/api/mint-token" && method === "POST") {
      const body = (await readJsonBody(req)) as { sub?: string };
      if (!body.sub) {
        throw new DomainError("cli.sub_required", "mint-token requires sub.");
      }
      const token = await createOperatorFromRoot(root, true).mintToken.execute(body.sub);
      sendJson(res, 200, { token, sub: body.sub });
      return;
    }
    if (path === "/api/schema" && method === "GET") {
      const operator = createOperatorFromRoot(root, true);
      try {
        sendJson(res, 200, { tables: await operator.admin.listTables() });
      } catch {
        // The database is only reachable while the stack is up.
        sendJson(res, 200, { tables: [], live: false });
      } finally {
        await operator.admin.close();
      }
      return;
    }
    if (path === "/api/schema" && method === "POST") {
      const change = createSchemaChange(
        (await readJsonBody(req)) as Parameters<typeof createSchemaChange>[0],
      );
      const operator = createOperatorFromRoot(root, true);
      try {
        const result = await operator.changeSchema.execute(change);
        sendJson(res, 200, { statement: result.statement, tables: result.tables });
      } finally {
        await operator.admin.close();
      }
      return;
    }
    if (path === "/api/history" && method === "GET") {
      const operator = createOperatorFromRoot(root, true);
      try {
        sendJson(res, 200, { entries: await operator.admin.history(50) });
      } finally {
        await operator.admin.close();
      }
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
