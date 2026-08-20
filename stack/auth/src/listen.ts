import { createServer } from "node:http";
import { connectAuthDb } from "./db.ts";
import { handleAuthRequest } from "./handle.ts";
import { createMailer } from "./mailer.ts";
import { createRateLimiter } from "./rate-limit.ts";
import { tokenSecret } from "./token.ts";
import { DEFAULT_ACCESS_TTL, DEFAULT_REFRESH_TTL, parseTtl } from "../../shared/ttl.ts";

const port = Number(process.env.PORT ?? "3001");
const authPassword = required("AUTH_SERVICE_PASSWORD");
const secret = tokenSecret(required("JWT_SECRET"));
const role = process.env.CALLER_ROLE || "app_user";
const accessTtlSeconds = parseTtl(process.env.ACCESS_TOKEN_TTL ?? "", DEFAULT_ACCESS_TTL);
const refreshTtlSeconds = parseTtl(process.env.REFRESH_TOKEN_TTL ?? "", DEFAULT_REFRESH_TTL);
const siteUrl = process.env.SITE_URL || "http://localhost:3000";
const requireEmailConfirm = flag("REQUIRE_EMAIL_CONFIRM");

const db = connectAuthDb({ authPassword });
const config = {
  db,
  secret,
  role,
  accessTtlSeconds,
  refreshTtlSeconds,
  mailer: createMailer(process.env),
  limiter: createRateLimiter(),
  siteUrl,
  requireEmailConfirm,
};
const server = createServer((req, res) => {
  void handleAuthRequest(config, req, res).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "Unknown error.";
    res.writeHead(500, { "content-type": "application/json" });
    res.end(JSON.stringify({ code: "auth.internal", message }));
  });
});

const PRUNE_EVERY_MS = 6 * 60 * 60 * 1000;
const PRUNE_GRACE_DAYS = Number(process.env.REFRESH_TOKEN_GRACE_DAYS ?? "7");

// Housekeeping, not a feature. A failure here is a log line, never a 500.
setInterval(() => {
  void prune("refresh token", db.pruneRefreshTokens(PRUNE_GRACE_DAYS));
  void prune("one-time token", db.pruneOneTimeTokens(PRUNE_GRACE_DAYS));
}, PRUNE_EVERY_MS).unref();

async function prune(what: string, work: Promise<number>): Promise<void> {
  try {
    const removed = await work;
    if (removed > 0) {
      process.stdout.write(`auth: pruned ${String(removed)} spent ${what}(s)\n`);
    }
  } catch (error: unknown) {
    process.stderr.write(
      `auth: ${what} prune failed: ${error instanceof Error ? error.message : String(error)}\n`,
    );
  }
}

server.listen(port, "0.0.0.0", () => {
  process.stdout.write(
    `auth listening on ${port} (access ${accessTtlSeconds}s, refresh ${refreshTtlSeconds}s` +
      `${requireEmailConfirm ? ", email confirmation required" : ""})\n`,
  );
});

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing ${name}.`);
  }
  return value;
}

function flag(name: string): boolean {
  const value = (process.env[name] ?? "").trim().toLowerCase();
  return value === "true" || value === "1" || value === "yes";
}
