import type { IncomingMessage, ServerResponse } from "node:http";
import { assertPassword, normalizeEmail } from "./email.ts";
import { hashPassword, verifyPassword } from "./password.ts";
import type { AuthDb } from "./db.ts";
import { readUserId, signUserToken, type AuthUser } from "./token.ts";

export type AuthConfig = {
  db: AuthDb;
  secret: Uint8Array;
  role: string;
};

type JsonBody = { email?: unknown; password?: unknown };

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
  if (path === "/signup" && method === "POST") {
    await signup(config, req, res);
    return;
  }
  if (path === "/login" && method === "POST") {
    await login(config, req, res);
    return;
  }
  if (path === "/me" && method === "GET") {
    await me(config, req, res);
    return;
  }
  sendJson(res, 404, { code: "auth.not_found", message: "Unknown auth route." });
}

async function signup(
  config: AuthConfig,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const parsed = await readCredentials(req, res, { requireStrength: true });
  if (!parsed) {
    return;
  }
  try {
    const passwordHash = await hashPassword(parsed.password);
    const user = await config.db.insertUser(parsed.email, passwordHash);
    await sendSession(config, res, 201, user);
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
  const parsed = await readCredentials(req, res, { requireStrength: false });
  if (!parsed) {
    return;
  }
  const row = await config.db.findByEmail(parsed.email);
  if (!row || !(await verifyPassword(parsed.password, row.passwordHash))) {
    sendJson(res, 401, {
      code: "auth.invalid_credentials",
      message: "Email or password is wrong.",
    });
    return;
  }
  await sendSession(config, res, 200, { id: row.id, email: row.email });
}

async function me(
  config: AuthConfig,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : undefined;
  if (!token) {
    sendJson(res, 401, { code: "auth.missing_token", message: "Sign in first." });
    return;
  }
  const id = await readUserId(config.secret, token);
  const user = id ? await config.db.findById(id) : undefined;
  if (!user) {
    sendJson(res, 401, { code: "auth.invalid_token", message: "Token was rejected." });
    return;
  }
  sendJson(res, 200, { user });
}

async function sendSession(
  config: AuthConfig,
  res: ServerResponse,
  status: number,
  user: AuthUser,
): Promise<void> {
  const token = await signUserToken(config.secret, user, config.role);
  sendJson(res, status, { token, user });
}

async function readCredentials(
  req: IncomingMessage,
  res: ServerResponse,
  options: { requireStrength: boolean },
): Promise<{ email: string; password: string } | undefined> {
  const body = (await readJsonBody(req)) as JsonBody;
  const email = typeof body.email === "string" ? normalizeEmail(body.email) : undefined;
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
    const passwordError = assertPassword(password);
    if (passwordError) {
      sendJson(res, 400, { code: "auth.weak_password", message: passwordError });
      return undefined;
    }
  }
  return { email, password };
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
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

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "23505";
}
