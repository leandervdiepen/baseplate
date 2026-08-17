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

type Session = { token: string; user: { id: string; email: string } };
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
