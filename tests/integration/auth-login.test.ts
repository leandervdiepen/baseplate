import { afterAll, beforeAll, expect, test } from "vitest";
import { spawn } from "node:child_process";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "../..");
const BASE_URL = "http://127.0.0.1:8080";

let startedHere = false;

beforeAll(async () => {
  if (await isUp()) {
    return;
  }
  startedHere = true;
  await run("docker", [
    "compose",
    "--env-file",
    resolve(ROOT, "operator.env.example"),
    "--project-name",
    "baseplate-it",
    "-f",
    "compose.yaml",
    "up",
    "-d",
    "--build",
    "--wait",
    "--wait-timeout",
    "180",
  ], resolve(ROOT, "stack"));
});

afterAll(async () => {
  if (!startedHere) {
    return;
  }
  await run("docker", [
    "compose",
    "--project-name",
    "baseplate-it",
    "-f",
    "compose.yaml",
    "down",
    "-v",
  ], resolve(ROOT, "stack"));
});

test("signup issues a JWT that can insert and read own rows", async () => {
  const email = `alice-${Date.now()}@example.com`;
  const session = await auth("signup", email, "a-long-password");
  expect(session.user.email).toBe(email);
  const body = `hello-${Date.now()}`;
  const created = await postItem(session.token, body);
  expect(created.owner_id).toBe(session.user.id);
  const rows = await listItems(session.token);
  expect(rows.some((row) => row.body === body)).toBe(true);
});

test("two accounts cannot see each other's rows", async () => {
  const stamp = Date.now();
  const alice = await auth("signup", `a-${stamp}@example.com`, "a-long-password");
  const bob = await auth("signup", `b-${stamp}@example.com`, "a-long-password");
  await postItem(alice.token, `alice-${stamp}`);
  await postItem(bob.token, `bob-${stamp}`);
  const rowsA = await listItems(alice.token);
  const rowsB = await listItems(bob.token);
  expect(rowsA.some((row) => row.body === `bob-${stamp}`)).toBe(false);
  expect(rowsB.some((row) => row.body === `alice-${stamp}`)).toBe(false);
});

test("duplicate email is rejected", async () => {
  const email = `dup-${Date.now()}@example.com`;
  await auth("signup", email, "a-long-password");
  const response = await fetch(`${BASE_URL}/auth/signup`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password: "a-long-password" }),
  });
  expect(response.status).toBe(409);
});

test("wrong password is rejected", async () => {
  const email = `pw-${Date.now()}@example.com`;
  await auth("signup", email, "a-long-password");
  const response = await fetch(`${BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password: "nope-nope" }),
  });
  expect(response.status).toBe(401);
});

test("an access token carries an expiry", async () => {
  const session = await auth("signup", `exp-${Date.now()}@example.com`, "a-long-password");

  expect(session.expiresIn).toBeGreaterThan(0);
  const claims = readClaims(session.token);
  expect(claims.exp - claims.iat).toBe(session.expiresIn);
});

test("a refresh token buys a new session and cannot be spent twice", async () => {
  const session = await auth("signup", `ref-${Date.now()}@example.com`, "a-long-password");

  const renewed = await post("/auth/refresh", { refreshToken: session.refreshToken });
  expect(renewed.status).toBe(200);
  const next = (await renewed.json()) as Session;
  expect(next.refreshToken).not.toBe(session.refreshToken);
  expect(next.user.id).toBe(session.user.id);

  const replay = await post("/auth/refresh", { refreshToken: session.refreshToken });
  expect(replay.status).toBe(401);
});

test("a refreshed token reads the rows the first one wrote", async () => {
  const session = await auth("signup", `own-${Date.now()}@example.com`, "a-long-password");
  const body = `before-refresh-${Date.now()}`;
  await postItem(session.token, body);

  const renewed = (await (
    await post("/auth/refresh", { refreshToken: session.refreshToken })
  ).json()) as Session;

  const rows = await listItems(renewed.token);
  expect(rows.some((row) => row.body === body)).toBe(true);
});

test("logging out revokes the refresh token", async () => {
  const session = await auth("signup", `out-${Date.now()}@example.com`, "a-long-password");

  expect((await post("/auth/logout", { refreshToken: session.refreshToken })).status).toBe(200);

  const after = await post("/auth/refresh", { refreshToken: session.refreshToken });
  expect(after.status).toBe(401);
});

test("an expired access token is refused by the API", async () => {
  const session = await auth("signup", `old-${Date.now()}@example.com`, "a-long-password");
  const expired = await signExpired(session.user.id);

  const response = await fetch(`${BASE_URL}/items`, {
    headers: { Authorization: `Bearer ${expired}` },
  });

  expect(response.status).toBe(401);
});

function post(path: string, body: unknown): Promise<Response> {
  return fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function readClaims(token: string): { exp: number; iat: number } {
  const part = token.split(".")[1] ?? "";
  return JSON.parse(Buffer.from(part, "base64url").toString("utf8")) as {
    exp: number;
    iat: number;
  };
}

async function signExpired(subject: string): Promise<string> {
  const { SignJWT } = await import("jose");
  const secret = new TextEncoder().encode(
    "dev-jwt-secret-must-be-at-least-32-chars",
  );
  return new SignJWT({ role: "app_user" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(subject)
    .setIssuedAt(Math.floor(Date.now() / 1000) - 7200)
    .setExpirationTime(Math.floor(Date.now() / 1000) - 3600)
    .sign(secret);
}

async function auth(kind: "signup" | "login", email: string, password: string): Promise<Session> {
  const response = await fetch(`${BASE_URL}/auth/${kind}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const text = await response.text();
  expect(response.status, text).toBe(kind === "signup" ? 201 : 200);
  return JSON.parse(text) as Session;
}

async function postItem(token: string, body: string): Promise<Item> {
  const response = await fetch(`${BASE_URL}/items`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify({ body }),
  });
  const text = await response.text();
  expect(response.status, text).toBe(201);
  const rows = JSON.parse(text) as Item[];
  const row = rows[0];
  expect(row).toBeDefined();
  return row as Item;
}

async function listItems(token: string): Promise<Item[]> {
  const response = await fetch(`${BASE_URL}/items`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(response.status).toBe(200);
  return (await response.json()) as Item[];
}

async function isUp(): Promise<boolean> {
  try {
    const response = await fetch(`${BASE_URL}/auth/health`);
    return response.ok;
  } catch {
    return false;
  }
}

type Session = {
  token: string;
  refreshToken: string;
  expiresIn: number;
  user: { id: string; email: string };
};
type Item = { id: string; owner_id: string; body: string };

function run(command: string, args: string[], cwd: string): Promise<void> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { cwd, stdio: "inherit" });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolvePromise();
        return;
      }
      reject(new Error(`${command} exited ${code}`));
    });
  });
}
