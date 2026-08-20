import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * The three auth files added with password reset all need the same three
 * things: a stack that is up, an auth call that survives the rate limiter, and
 * a way to read the dev inbox. They live here once rather than three times.
 *
 * Not a `.test.ts` file, so the integration config does not collect it.
 */
export const ROOT = resolve(import.meta.dirname, "../../..");
export const BASE_URL = "http://127.0.0.1:8080";

export type Session = {
  token: string;
  refreshToken: string;
  expiresIn: number;
  user: { id: string; email: string };
};

/** What `/auth/me` answers with. Dates cross the wire as ISO strings or null. */
export type MeUser = {
  id: string;
  email: string;
  createdAt: string;
  lastSignInAt: string | null;
  emailConfirmedAt: string | null;
};

export type Item = { id: string; owner_id: string; body: string };

/** Reads a value out of the env file the running stack was started from. */
export function stackEnv(key: string, fallback = ""): string {
  const line = readFileSync(resolve(ROOT, ".baseplate/stack.env"), "utf8")
    .split("\n")
    .find((entry) => entry.startsWith(`${key}=`));
  return line ? line.slice(key.length + 1).trim() : fallback;
}

export async function isUp(): Promise<boolean> {
  try {
    const response = await fetch(`${BASE_URL}/auth/health`);
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * True when this process is the one that started the stack, which is also the
 * only case in which it may take it down again. A developer with `baseplate
 * up` running gets their stack left alone.
 */
export async function bootStack(): Promise<boolean> {
  if (await isUp()) {
    return false;
  }
  await run(
    "docker",
    [
      "compose",
      "--env-file",
      resolve(ROOT, ".baseplate/stack.env"),
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
    ],
    resolve(ROOT, "stack"),
  );
  return true;
}

export async function downStack(startedHere: boolean): Promise<void> {
  if (!startedHere) {
    return;
  }
  await run(
    "docker",
    ["compose", "--project-name", "baseplate-it", "-f", "compose.yaml", "down", "-v"],
    resolve(ROOT, "stack"),
  );
}

/**
 * App tables live in the database, not in this repo, so a suite that needs one
 * makes it the same way an operator would.
 */
export async function ensureItemsTable(): Promise<void> {
  await run("./scripts/dev", ["schema", "add-table", "items", "--column", "body:text"], ROOT).catch(
    () => undefined,
  );
}

export function post(path: string, body: unknown): Promise<Response> {
  return fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

/** How many 429s a call rides out before giving up, and the longest single wait. */
const RETRY_ATTEMPTS = 4;
const MAX_WAIT_MS = 20_000;

/**
 * Credential endpoints allow ten calls a minute per IP, and every file in this
 * suite arrives from the same one. A test that is not about the limiter should
 * not fail because a test that is spent the budget, so these calls wait out a
 * 429 and try again. `rate-limit.test.ts` deliberately uses `post` instead.
 */
export async function authPost(path: string, body: unknown): Promise<Response> {
  for (let attempt = 0; attempt < RETRY_ATTEMPTS; attempt += 1) {
    const response = await post(path, body);
    if (response.status !== 429) {
      return response;
    }
    await response.text();
    await sleep(retryAfterMs(response));
  }
  return post(path, body);
}

export async function signUp(email: string, password: string): Promise<Session> {
  const response = await authPost("/auth/signup", { email, password });
  const text = await response.text();
  if (response.status !== 201) {
    throw new Error(`signup ${email} answered ${String(response.status)}: ${text}`);
  }
  return JSON.parse(text) as Session;
}

export function login(email: string, password: string): Promise<Response> {
  return authPost("/auth/login", { email, password });
}

export async function readSession(response: Response): Promise<Session> {
  const text = await response.text();
  if (response.status !== 200) {
    throw new Error(`expected a session, got ${String(response.status)}: ${text}`);
  }
  return JSON.parse(text) as Session;
}

export async function readCode(response: Response): Promise<string> {
  const text = await response.text();
  try {
    return (JSON.parse(text) as { code?: string }).code ?? "";
  } catch {
    return text;
  }
}

export async function me(token: string): Promise<MeUser> {
  const response = await fetch(`${BASE_URL}/auth/me`, {
    headers: { authorization: `Bearer ${token}` },
  });
  const text = await response.text();
  if (response.status !== 200) {
    throw new Error(`/auth/me answered ${String(response.status)}: ${text}`);
  }
  return (JSON.parse(text) as { user: MeUser }).user;
}

export async function postItem(token: string, body: string): Promise<Item> {
  const response = await fetch(`${BASE_URL}/items`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify({ body }),
  });
  const text = await response.text();
  if (response.status !== 201) {
    throw new Error(`insert answered ${String(response.status)}: ${text}`);
  }
  const row = (JSON.parse(text) as Item[])[0];
  if (!row) {
    throw new Error("the insert returned no row");
  }
  return row;
}

export async function listItems(token: string): Promise<Item[]> {
  const response = await fetch(`${BASE_URL}/items`, {
    headers: { authorization: `Bearer ${token}` },
  });
  const text = await response.text();
  if (response.status !== 200) {
    throw new Error(`select answered ${String(response.status)}: ${text}`);
  }
  return JSON.parse(text) as Item[];
}

function retryAfterMs(response: Response): number {
  const seconds = Number(response.headers.get("retry-after") ?? "1");
  const wait = Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : 1000;
  return Math.min(MAX_WAIT_MS, wait + 250);
}

export function sleep(ms: number): Promise<void> {
  return new Promise((done) => setTimeout(done, ms));
}

export function run(command: string, args: string[], cwd: string): Promise<void> {
  return new Promise((done, fail) => {
    const child = spawn(command, args, { cwd, stdio: "inherit" });
    child.on("error", fail);
    child.on("exit", (code) => {
      if (code === 0) {
        done();
        return;
      }
      fail(new Error(`${command} exited ${String(code)}`));
    });
  });
}
