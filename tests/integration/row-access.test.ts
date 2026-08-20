import { decodeJwt } from "jose";
import { afterAll, beforeAll, expect, test } from "vitest";
import { JwtTokenSigner } from "#infrastructure";
import { createTokenClaims, parseCallerId } from "#domain";
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "../..");
const BASE_URL = "http://127.0.0.1:8080";
// Secrets are generated per project now, so the suite reads the one in use
// rather than assuming a shared development value.
const SECRET = readSecret();
const ALICE = parseCallerId("11111111-1111-4111-8111-111111111111");
const BOB = parseCallerId("22222222-2222-4222-8222-222222222222");

function readSecret(): string {
  const text = readFileSync(resolve(ROOT, "baseplate.env"), "utf8");
  const match = /^JWT_SECRET=(.+)$/m.exec(text);
  if (!match?.[1]) {
    throw new Error("No JWT_SECRET in baseplate.env. Run `./scripts/dev init` first.");
  }
  return match[1].trim();
}

let startedHere = false;

beforeAll(async () => {
  if (await isUp()) {
    return;
  }
  startedHere = true;
  await run("docker", [
    "compose",
    "--env-file",
    resolve(ROOT, ".baseplate/stack.env"),
    "--project-name",
    "baseplate-it",
    "-f",
    "compose.yaml",
    "up",
    "-d",
    "--wait",
  ], resolve(ROOT, "stack"));
});

beforeAll(async () => {
  // App tables live in the database, not in this repo, so the suite makes the
  // one it needs the same way an operator would.
  await run(
    "./scripts/dev",
    ["schema", "add-table", "items", "--column", "body:text"],
    ROOT,
  ).catch(() => undefined);
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

test("each caller reads only their own rows", async () => {
  const signer = new JwtTokenSigner(SECRET);
  const tokenA = await signer.sign(createTokenClaims(ALICE, "app_user", 3600));
  const tokenB = await signer.sign(createTokenClaims(BOB, "app_user", 3600));
  const bodyA = `alice-row-${Date.now()}`;
  const bodyB = `bob-row-${Date.now()}`;

  const createdA = await postItem(tokenA, bodyA);
  const createdB = await postItem(tokenB, bodyB);
  expect(createdA.owner_id).toBe(ALICE);
  expect(createdB.owner_id).toBe(BOB);

  const rowsA = await listItems(tokenA);
  const rowsB = await listItems(tokenB);
  expect(rowsA.every((row) => row.owner_id === ALICE)).toBe(true);
  expect(rowsB.every((row) => row.owner_id === BOB)).toBe(true);
  expect(rowsA.some((row) => row.body === bodyA)).toBe(true);
  expect(rowsB.some((row) => row.body === bodyB)).toBe(true);
  expect(rowsA.some((row) => row.body === bodyB)).toBe(false);
  expect(rowsB.some((row) => row.body === bodyA)).toBe(false);
});

test("a missing token is rejected", async () => {
  const response = await fetch(`${BASE_URL}/items`);
  expect(response.status).toBeGreaterThanOrEqual(400);
});

test("a tampered token is rejected", async () => {
  const signer = new JwtTokenSigner(SECRET);
  const token = await signer.sign(createTokenClaims(ALICE, "app_user", 3600));
  const payload = decodeJwt(token);
  expect(payload.sub).toBe(ALICE);
  const tampered = `${token.slice(0, -4)}xxxx`;
  const response = await fetch(`${BASE_URL}/items`, {
    headers: { Authorization: `Bearer ${tampered}` },
  });
  expect(response.status).toBeGreaterThanOrEqual(400);
});

async function isUp(): Promise<boolean> {
  try {
    const response = await fetch(BASE_URL);
    return response.status === 200 || response.status === 401;
  } catch {
    return false;
  }
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
  expect(response.status).toBe(201);
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

/**
 * `/auth*` in the Caddyfile also matches `/authors`, so a table whose name
 * starts with a route prefix used to be answered by the wrong service and 404
 * for reasons nothing on screen could explain.
 */
test("a table whose name starts with a route prefix is still the API's", async () => {
  await run(
    "./scripts/dev",
    ["schema", "add-table", "authored", "--column", "note:text"],
    ROOT,
  ).catch(() => undefined);
  const token = await new JwtTokenSigner(SECRET).sign(createTokenClaims(ALICE, "app_user", 3600));

  const response = await fetch(`${BASE_URL}/authored?limit=1`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  expect(response.status).toBe(200);
  expect(Array.isArray(await response.json())).toBe(true);
});
