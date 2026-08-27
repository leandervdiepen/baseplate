import type { IncomingMessage, ServerResponse } from "node:http";
import type { OneTimeTokenPurpose } from "./db.ts";
import { assertPassword, normalizeEmail } from "./email.ts";
import type { AuthConfig } from "./handle.ts";
import { authenticate, readJsonBody, sendJson } from "./http.ts";
import { buildRecoveryEmail, buildVerifyEmail, type EmailBody } from "./mailer.ts";
import { hashPassword, verifyPassword } from "./password.ts";
import { clientIp, RATE_POLICIES, throttled } from "./rate-limit.ts";
import { issueSession } from "./session.ts";
import { createOpaqueToken, hashToken } from "./token.ts";

const RECOVERY_TTL_SECONDS = 60 * 60;
const VERIFY_TTL_SECONDS = 24 * 60 * 60;

/**
 * Always 200. Saying whether an address has an account would turn the
 * forgot-password form into a list of everybody who uses the app.
 */
export async function recover(
  config: AuthConfig,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const body = await readJsonBody(req, res);
  if (!body) {
    return;
  }
  const email = typeof body.email === "string" ? normalizeEmail(body.email) : undefined;
  if (sendThrottled(config, req, res, email)) {
    return;
  }
  const user = email ? await config.db.findByEmail(email) : undefined;
  if (user && email) {
    const token = await issueOneTimeToken(config, user.id, "recovery", RECOVERY_TTL_SECONDS);
    deliver(config, email, buildRecoveryEmail(config.siteUrl, token));
  }
  sendJson(res, 200, { ok: true });
}

/**
 * The token is spent before the password is judged, so a weak password does not
 * hand back a still-live link to try again with. Every other session dies here:
 * whoever needed a reset may be recovering from someone else having the old one.
 */
export async function recoverConfirm(
  config: AuthConfig,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const body = await readJsonBody(req, res);
  if (!body) {
    return;
  }
  if (throttled(config.limiter, res, [[RATE_POLICIES.credentialsPerIp, clientIp(req)]])) {
    return;
  }
  const presented = typeof body.token === "string" ? body.token : "";
  const userId = presented
    ? await config.db.consumeOneTimeToken("recovery", hashToken(presented))
    : undefined;
  const user = userId ? await config.db.findById(userId) : undefined;
  if (!user) {
    sendJson(res, 401, {
      code: "auth.invalid_reset_token",
      message: "That reset link has expired or was already used. Ask for a new one.",
    });
    return;
  }
  const password = typeof body.password === "string" ? body.password : "";
  const weak = assertPassword(password);
  if (weak) {
    sendJson(res, 400, { code: "auth.weak_password", message: weak });
    return;
  }
  await config.db.updatePassword(user.id, await hashPassword(password));
  await config.db.revokeAllForUser(user.id);
  // Receiving mail at the address proves it as well as a verify link does.
  await config.db.confirmEmail(user.id);
  await config.db.touchLastSignIn(user.id);
  sendJson(res, 200, await issueSession(config.db, config, { id: user.id, email: user.email }));
}

/**
 * Changing a password ends every other session and starts a fresh one, so the
 * caller that did it stays signed in and nothing else does.
 */
export async function changePassword(
  config: AuthConfig,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const body = await readJsonBody(req, res);
  if (!body) {
    return;
  }
  if (throttled(config.limiter, res, [[RATE_POLICIES.credentialsPerIp, clientIp(req)]])) {
    return;
  }
  const user = await authenticate(config, req, res);
  if (!user) {
    return;
  }
  const current = typeof body.currentPassword === "string" ? body.currentPassword : "";
  if (!(await verifyPassword(current, user.passwordHash))) {
    sendJson(res, 401, {
      code: "auth.invalid_credentials",
      message: "That is not your current password.",
    });
    return;
  }
  const next = typeof body.newPassword === "string" ? body.newPassword : "";
  const weak = assertPassword(next);
  if (weak) {
    sendJson(res, 400, { code: "auth.weak_password", message: weak });
    return;
  }
  await config.db.updatePassword(user.id, await hashPassword(next));
  await config.db.revokeAllForUser(user.id);
  sendJson(res, 200, await issueSession(config.db, config, { id: user.id, email: user.email }));
}

/** Always 200, for the same reason `recover` is. */
export async function verifyRequest(
  config: AuthConfig,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const body = await readJsonBody(req, res);
  if (!body) {
    return;
  }
  const email = typeof body.email === "string" ? normalizeEmail(body.email) : undefined;
  if (sendThrottled(config, req, res, email)) {
    return;
  }
  const user = email ? await config.db.findByEmail(email) : undefined;
  // An address that is already confirmed has nothing to confirm.
  if (user && !user.emailConfirmedAt) {
    await sendVerifyEmail(config, user.id, user.email);
  }
  sendJson(res, 200, { ok: true });
}

export async function verifyConfirm(
  config: AuthConfig,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const body = await readJsonBody(req, res);
  if (!body) {
    return;
  }
  if (throttled(config.limiter, res, [[RATE_POLICIES.credentialsPerIp, clientIp(req)]])) {
    return;
  }
  const presented = typeof body.token === "string" ? body.token : "";
  const userId = presented
    ? await config.db.consumeOneTimeToken("email_verify", hashToken(presented))
    : undefined;
  if (!userId) {
    sendJson(res, 401, {
      code: "auth.invalid_verify_token",
      message: "That confirmation link has expired or was already used.",
    });
    return;
  }
  await config.db.confirmEmail(userId);
  sendJson(res, 200, { ok: true });
}

/** Used by signup too, which sends one whether or not confirmation is enforced. */
export async function sendVerifyEmail(
  config: AuthConfig,
  userId: string,
  email: string,
): Promise<void> {
  const token = await issueOneTimeToken(config, userId, "email_verify", VERIFY_TTL_SECONDS);
  deliver(config, email, buildVerifyEmail(config.siteUrl, token));
}

async function issueOneTimeToken(
  config: AuthConfig,
  userId: string,
  purpose: OneTimeTokenPurpose,
  ttlSeconds: number,
): Promise<string> {
  const value = createOpaqueToken();
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
  await config.db.insertOneTimeToken(userId, purpose, hashToken(value), expiresAt);
  return value;
}

/**
 * Not awaited. Waiting on a mail server would time how long the lookup took,
 * which is the enumeration side channel these endpoints exist to avoid.
 */
function deliver(config: AuthConfig, to: string, body: EmailBody): void {
  void config.mailer.send({ to, ...body }).catch(() => false);
}

function sendThrottled(
  config: AuthConfig,
  req: IncomingMessage,
  res: ServerResponse,
  email: string | undefined,
): boolean {
  const perIp = [RATE_POLICIES.sendPerIp, clientIp(req)] as const;
  const perEmail = [RATE_POLICIES.sendPerEmail, email ?? ""] as const;
  return throttled(config.limiter, res, email ? [perIp, perEmail] : [perIp]);
}
