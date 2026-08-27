import type { IncomingMessage, ServerResponse } from "node:http";
import {
  changePassword,
  recover,
  recoverConfirm,
  sendVerifyEmail,
  verifyConfirm,
  verifyRequest,
} from "./account.ts";
import type { AuthDb } from "./db.ts";
import { authenticate, readCredentials, readJsonBody, sendJson } from "./http.ts";
import type { Mailer } from "./mailer.ts";
import { DUMMY_HASH, hashPassword, verifyPassword } from "./password.ts";
import { clientIp, type RateLimiter } from "./rate-limit.ts";
import { issueSession } from "./session.ts";
import { hashToken, type TokenConfig } from "./token.ts";

export type AuthConfig = TokenConfig & {
  db: AuthDb;
  mailer: Mailer;
  limiter: RateLimiter;
  /** Where the app that owns these users lives; emailed links point at it. */
  siteUrl: string;
  requireEmailConfirm: boolean;
};

type Route = (c: AuthConfig, req: IncomingMessage, res: ServerResponse) => Promise<void>;

/** Eleven routes read better as a table than as a ladder of ifs. */
const ROUTES: Record<string, Route> = {
  "POST /signup": signup,
  "POST /login": login,
  "POST /refresh": refresh,
  "POST /logout": logout,
  "GET /me": me,
  "POST /recover": recover,
  "POST /recover/confirm": recoverConfirm,
  "POST /password": changePassword,
  "POST /verify/request": verifyRequest,
  "POST /verify/confirm": verifyConfirm,
};

export async function handleAuthRequest(
  config: AuthConfig,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const url = new URL(req.url ?? "/", "http://127.0.0.1");
  const path = url.pathname.replace(/^\/auth/, "") || "/";
  const method = req.method ?? "GET";
  if (path === "/health" && method === "GET") {
    sendJson(res, 200, { ok: true });
    return;
  }
  const route = ROUTES[`${method} ${path}`];
  if (!route) {
    sendJson(res, 404, { code: "auth.not_found", message: "Unknown auth route." });
    return;
  }
  await route(config, req, res);
}

async function signup(
  config: AuthConfig,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const parsed = await readCredentials(config, req, res, {
    requireStrength: true,
    limitPerEmail: false,
  });
  if (!parsed) {
    return;
  }
  try {
    const passwordHash = await hashPassword(parsed.password);
    const user = await config.db.insertUser(parsed.email, passwordHash);
    await sendVerifyEmail(config, user.id, user.email);
    if (config.requireEmailConfirm) {
      // No session: the SDK reads that as "check your inbox".
      sendJson(res, 201, { user });
      return;
    }
    await config.db.touchLastSignIn(user.id);
    sendJson(res, 201, await issueSession(config.db, config, user));
  } catch (error) {
    if (isUniqueViolation(error)) {
      sendJson(res, 409, {
        code: "auth.email_taken",
        message: "An account with that email already exists.",
      });
      return;
    }
    throw error;
  }
}

async function login(
  config: AuthConfig,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const ip = clientIp(req);
  const parsed = await readCredentials(config, req, res, {
    requireStrength: false,
    limitPerEmail: true,
  });
  if (!parsed) {
    return;
  }
  const row = await config.db.findByEmail(parsed.email);
  // Verified against a hash with no preimage when the email is unknown, so the
  // work done, and therefore the time taken, does not depend on who exists.
  const ok = await verifyPassword(parsed.password, row?.passwordHash ?? DUMMY_HASH);
  if (!row || !ok) {
    process.stdout.write(`auth: login failed email=${parsed.email} ip=${ip}\n`);
    sendJson(res, 401, {
      code: "auth.invalid_credentials",
      message: "Email or password is wrong.",
    });
    return;
  }
  if (config.requireEmailConfirm && !row.emailConfirmedAt) {
    sendJson(res, 403, {
      code: "auth.email_not_confirmed",
      message: "Confirm your email first.",
    });
    return;
  }
  await config.db.touchLastSignIn(row.id);
  sendJson(res, 200, await issueSession(config.db, config, { id: row.id, email: row.email }));
}

/**
 * Single use: the presented token is revoked and a new one issued. A replay of
 * an already-spent token gets nothing.
 */
async function refresh(
  config: AuthConfig,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const body = await readJsonBody(req, res);
  if (!body) {
    return;
  }
  const presented = typeof body.refreshToken === "string" ? body.refreshToken : undefined;
  const stored = presented
    ? await config.db.findLiveRefreshToken(hashToken(presented))
    : undefined;
  const user = stored ? await config.db.findById(stored.userId) : undefined;
  if (!stored || !user) {
    sendJson(res, 401, {
      code: "auth.invalid_refresh_token",
      message: "That session has expired. Sign in again.",
    });
    return;
  }
  await config.db.revokeRefreshToken(stored.id);
  sendJson(res, 200, await issueSession(config.db, config, { id: user.id, email: user.email }));
}

async function logout(
  config: AuthConfig,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const body = await readJsonBody(req, res);
  if (!body) {
    return;
  }
  if (typeof body.refreshToken === "string") {
    const stored = await config.db.findLiveRefreshToken(hashToken(body.refreshToken));
    if (stored) {
      await config.db.revokeRefreshToken(stored.id);
    }
  }
  sendJson(res, 200, { ok: true });
}

async function me(
  config: AuthConfig,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const user = await authenticate(config, req, res);
  if (!user) {
    return;
  }
  sendJson(res, 200, {
    user: {
      id: user.id,
      email: user.email,
      emailConfirmedAt: user.emailConfirmedAt,
      createdAt: user.createdAt,
      lastSignInAt: user.lastSignInAt,
    },
  });
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "23505";
}
