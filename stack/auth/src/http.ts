import type { IncomingMessage, ServerResponse } from "node:http";
import type { AuthRecord } from "./db.ts";
import { assertPassword, normalizeEmail } from "./email.ts";
import type { AuthConfig } from "./handle.ts";
import { clientIp, RATE_POLICIES, throttled } from "./rate-limit.ts";
import { readUserId } from "./token.ts";

export function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

export async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) {
    return {};
  }
  return JSON.parse(raw) as unknown;
}

/**
 * Bearer token in, user row out. Answers 401 itself, so a caller holding
 * undefined has nothing left to do.
 */
export async function authenticate(
  config: AuthConfig,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<AuthRecord | undefined> {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : undefined;
  if (!token) {
    sendJson(res, 401, { code: "auth.missing_token", message: "Sign in first." });
    return undefined;
  }
  const id = await readUserId(config.secret, token);
  const user = id ? await config.db.findById(id) : undefined;
  if (!user) {
    sendJson(res, 401, { code: "auth.invalid_token", message: "Token was rejected." });
    return undefined;
  }
  return user;
}

/**
 * The body is read before the limiter is asked, so a rejected caller still had
 * its request drained, and the email is normalised first so the per-email
 * bucket cannot be dodged by changing the case.
 *
 * Answers the request itself on every rejection and returns undefined; the
 * caller only ever sees a pair it can act on.
 */
export async function readCredentials(
  config: AuthConfig,
  req: IncomingMessage,
  res: ServerResponse,
  options: { requireStrength: boolean; limitPerEmail: boolean },
): Promise<{ email: string; password: string } | undefined> {
  const body = (await readJsonBody(req)) as { email?: unknown; password?: unknown };
  const email = typeof body.email === "string" ? normalizeEmail(body.email) : undefined;
  const perIp = [RATE_POLICIES.credentialsPerIp, clientIp(req)] as const;
  const checks =
    email && options.limitPerEmail
      ? [perIp, [RATE_POLICIES.loginPerEmail, email] as const]
      : [perIp];
  if (throttled(config.limiter, res, checks)) {
    return undefined;
  }
  const password = typeof body.password === "string" ? body.password : undefined;
  if (!email) {
    sendJson(res, 400, { code: "auth.invalid_email", message: "Enter a valid email." });
    return undefined;
  }
  if (!password) {
    sendJson(res, 400, { code: "auth.weak_password", message: "Password is required." });
    return undefined;
  }
  if (options.requireStrength) {
    const weak = assertPassword(password);
    if (weak) {
      sendJson(res, 400, { code: "auth.weak_password", message: weak });
      return undefined;
    }
  }
  return { email, password };
}
