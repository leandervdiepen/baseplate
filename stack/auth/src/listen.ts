import { createServer } from "node:http";
import { connectAuthDb } from "./db.ts";
import { handleAuthRequest } from "./handle.ts";
import { tokenSecret } from "./token.ts";
import { DEFAULT_ACCESS_TTL, DEFAULT_REFRESH_TTL, parseTtl } from "./ttl.ts";

const port = Number(process.env.PORT ?? "3001");
const authPassword = required("AUTH_SERVICE_PASSWORD");
const secret = tokenSecret(required("JWT_SECRET"));
const role = process.env.CALLER_ROLE || "app_user";
const accessTtlSeconds = parseTtl(process.env.ACCESS_TOKEN_TTL ?? "", DEFAULT_ACCESS_TTL);
const refreshTtlSeconds = parseTtl(process.env.REFRESH_TOKEN_TTL ?? "", DEFAULT_REFRESH_TTL);

const db = connectAuthDb({ authPassword });
const config = { db, secret, role, accessTtlSeconds, refreshTtlSeconds };
const server = createServer((req, res) => {
  void handleAuthRequest(config, req, res).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "Unknown error.";
    res.writeHead(500, { "content-type": "application/json" });
    res.end(JSON.stringify({ code: "auth.internal", message }));
  });
});

server.listen(port, "0.0.0.0", () => {
  process.stdout.write(
    `auth listening on ${port} (access ${accessTtlSeconds}s, refresh ${refreshTtlSeconds}s)\n`,
  );
});

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing ${name}.`);
  }
  return value;
}
