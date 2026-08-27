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

/**
 * The largest body any auth route has a use for. Generous: an email and a
 * password are a few hundred bytes. Enforced while reading, because the body
 * arrives before the rate limiter is asked anything.
 */
export const MAX_BODY_BYTES = 16 * 1024;

export type JsonObject = Record<string, unknown>;

/** The body, or `undefined` when this has already answered the request. */
export async function readJsonBody(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<JsonObject | undefined> {
  const declared = Number(req.headers["content-length"] ?? "0");
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
    tooLarge(req, res);
    return undefined;
  }
  const chunks: Buffer[] = [];
  let size = 0;
  try {
    for await (const chunk of req) {
      const buffer = typeof chunk === "string" ? Buffer.from(chunk) : chunk;
      size += buffer.length;
      if (size > MAX_BODY_BYTES) {
        tooLarge(req, res);
        return undefined;
      }
      chunks.push(buffer);
    }
  } catch {
    sendJson(res, 400, {
      code: "auth.body_unreadable",
      message: "The request body did not arrive in one piece.",
    });
    return undefined;
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) {
    return {};
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    sendJson(res, 400, { code: "auth.invalid_json", message: "Body must be JSON." });
    return undefined;
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    sendJson(res, 400, { code: "auth.invalid_json", message: "Body must be a JSON object." });
    return undefined;
  }
  return parsed as JsonObject;
}

/** Hung up after the response has left, or the caller gets a reset not a reason. */
function tooLarge(req: IncomingMessage, res: ServerResponse): void {
  res.writeHead(413, { "content-type": "application/json", connection: "close" });
  res.end(
    JSON.stringify({
      code: "auth.body_too_large",
      message: `A request body here may not be larger than ${String(MAX_BODY_BYTES)} bytes.`,
    }),
    () => {
      req.destroy();
    },
  );
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
 * The body comes first because one bucket is keyed on the email in it,
 * normalised so case cannot dodge it. Answers every rejection itself.
 */
export async function readCredentials(
  config: AuthConfig,
  req: IncomingMessage,
  res: ServerResponse,
  options: { requireStrength: boolean; limitPerEmail: boolean },
): Promise<{ email: string; password: string } | undefined> {
  const body = await readJsonBody(req, res);
  if (!body) {
    return undefined;
  }
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
