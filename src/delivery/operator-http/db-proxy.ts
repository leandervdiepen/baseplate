import type { IncomingMessage, ServerResponse } from "node:http";
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
  await proxyLocalStack(root, req, res, (url) => url.replace(/^\/api\/db/, "") || "/");
}

export async function proxyAuth(
  root: string,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  await proxyLocalStack(root, req, res, (url) => {
    const rest = url.replace(/^\/api\/auth/, "");
    return `/auth${rest || ""}`;
  });
}

async function proxyLocalStack(
  root: string,
  req: IncomingMessage,
  res: ServerResponse,
  rewrite: (url: string) => string,
): Promise<void> {
  const envPath = resolve(root, CONFIG_FILE);
  const env = parseEnvMap(readFileSync(envPath, "utf8"));
  const port = env.HTTP_PORT || "8080";
  const rest = rewrite(req.url ?? "/");
  const target = `http://127.0.0.1:${port}${rest}`;
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
    res.writeHead(response.status, {
      "content-type": response.headers.get("content-type") ?? "application/json",
    });
    res.end(body);
  } catch {
    sendJson(res, 503, {
      code: "operator.api_down",
      message: "API is down. Provision the stack from Settings.",
    });
  }
}
