import type { IncomingMessage, ServerResponse } from "node:http";
import { apiBaseFor } from "./api-base.ts";
import { parseEnvMap } from "./env-file.ts";
import { CONFIG_FILE } from "../paths.ts";
import { sendJson } from "./json.ts";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export async function proxyPostgrest(
  root: string,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  await proxyStack(root, req, res, (url) => url.replace(/^\/api\/db/, "") || "/");
}

export async function proxyAuth(
  root: string,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  await proxyStack(root, req, res, (url) => {
    const rest = url.replace(/^\/api\/auth/, "");
    return `/auth${rest || ""}`;
  });
}

async function proxyStack(
  root: string,
  req: IncomingMessage,
  res: ServerResponse,
  rewrite: (url: string) => string,
): Promise<void> {
  const envPath = resolve(root, CONFIG_FILE);
  const env = parseEnvMap(readFileSync(envPath, "utf8"));
  const rest = rewrite(req.url ?? "/");
  const target = `${apiBaseFor(env)}${rest}`;
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  const headers = new Headers();
  const auth = req.headers.authorization;
  if (auth) {
    headers.set("authorization", auth);
  }
  const contentType = req.headers["content-type"];
  if (contentType) {
    headers.set("content-type", contentType);
  }
  const prefer = req.headers.prefer;
  if (typeof prefer === "string") {
    headers.set("prefer", prefer);
  }
  // The stack sees every studio call arriving from Caddy, so without this a
  // rate limiter on the auth service would count them all as one client.
  const origin = req.socket.remoteAddress;
  if (origin) {
    headers.set("x-forwarded-for", origin);
  }
  const init: RequestInit = {
    method: req.method ?? "GET",
    headers,
  };
  if (chunks.length > 0) {
    init.body = Buffer.concat(chunks);
  }
  try {
    const response = await fetch(target, init);
    const body = Buffer.from(await response.arrayBuffer());
    // PostgREST answers `Prefer: count=exact` in Content-Range and nowhere
    // else, so dropping it here would mean the studio could never say how many
    // rows a caller can see.
    const range = response.headers.get("content-range");
    res.writeHead(response.status, {
      "content-type": response.headers.get("content-type") ?? "application/json",
      ...(range ? { "content-range": range } : {}),
    });
    res.end(body);
  } catch {
    // Naming the address matters once a project can point somewhere else: an
    // operator whose server is down should not read this as their laptop.
    sendJson(res, 503, {
      code: "operator.api_down",
      message: `No answer from ${apiBaseFor(env)}. Start the stack, or check Settings.`,
    });
  }
}
