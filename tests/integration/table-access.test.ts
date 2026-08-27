import { afterAll, beforeAll, expect, test } from "vitest";
import { createTokenClaims, parseCallerId } from "#domain";
import { JwtTokenSigner } from "#infrastructure";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { BASE_URL, bootStack, downStack, ROOT, run } from "./support/stack.ts";

/**
 * The three read modes, proved against the running stack rather than against
 * the SQL that builds them. Writes are checked in every mode too: widening a
 * read must never widen a write.
 */

const ALICE = parseCallerId("33333333-3333-4333-8333-333333333333");
const BOB = parseCallerId("44444444-4444-4444-8444-444444444444");

let startedHere = false;
let alice = "";
let bob = "";

beforeAll(async () => {
  startedHere = await bootStack();
});

beforeAll(async () => {
  const tables: { table: string; access: string }[] = [
    { table: "kept", access: "private" },
    { table: "posted", access: "shared" },
    { table: "published", access: "public" },
  ];
  for (const { table, access } of tables) {
    await run(
      "./scripts/dev",
      ["schema", "add-table", table, "--column", "body:text", "--access", access],
      ROOT,
    ).catch(() => undefined);
  }
  const signer = new JwtTokenSigner(secret());
  alice = await signer.sign(createTokenClaims(ALICE, "app_user", 3600));
  bob = await signer.sign(createTokenClaims(BOB, "app_user", 3600));
});

afterAll(async () => {
  await downStack(startedHere);
});

test("a private table shows a caller their own rows and nobody else's", async () => {
  await insert("kept", alice, "alice kept this");
  await insert("kept", bob, "bob kept this");

  expect(await bodies("kept", alice)).toEqual(["alice kept this"]);
  expect(await bodies("kept", bob)).toEqual(["bob kept this"]);
  expect((await read("kept")).status).toBeGreaterThanOrEqual(400);
});

test("a shared table shows every row to anyone signed in, and none without a token", async () => {
  await insert("posted", alice, "alice posted this");
  await insert("posted", bob, "bob posted this");

  expect((await bodies("posted", alice)).sort()).toEqual([
    "alice posted this",
    "bob posted this",
  ]);
  expect((await bodies("posted", bob)).sort()).toEqual(["alice posted this", "bob posted this"]);
  expect((await read("posted")).status).toBeGreaterThanOrEqual(400);
});

test("a public table is read with no token at all", async () => {
  await insert("published", alice, "alice published this");

  const response = await read("published");
  expect(response.status).toBe(200);
  expect(((await response.json()) as Row[]).map((row) => row.body)).toContain(
    "alice published this",
  );
});

test("a wider read never widens a write", async () => {
  const target = await insert("posted", alice, `alice owns this ${String(Date.now())}`);

  // Bob can see the row - the table is shared - and still cannot touch it.
  expect(await bodies("posted", bob)).toContain(target.body);
  const patched = await fetch(`${BASE_URL}/posted?id=eq.${target.id}`, {
    method: "PATCH",
    headers: { authorization: `Bearer ${bob}`, "content-type": "application/json" },
    body: JSON.stringify({ body: "bob took it" }),
  });
  expect(patched.status).toBe(204);

  expect(await bodies("posted", bob)).toContain(target.body);
});

test("an anonymous write is refused even where an anonymous read is allowed", async () => {
  const response = await fetch(`${BASE_URL}/published`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ body: "nobody wrote this" }),
  });

  expect(response.status).toBeGreaterThanOrEqual(400);
});

test("narrowing a table takes the wider read away", async () => {
  await run("./scripts/dev", ["schema", "set-access", "published", "private"], ROOT);

  expect((await read("published")).status).toBeGreaterThanOrEqual(400);
  expect(await bodies("published", bob)).toEqual([]);

  await run("./scripts/dev", ["schema", "set-access", "published", "public"], ROOT);
  expect((await read("published")).status).toBe(200);
});

type Row = { id: string; owner_id: string; body: string };

function secret(): string {
  const text = readFileSync(resolve(ROOT, "baseplate.env"), "utf8");
  const match = /^JWT_SECRET=(.+)$/m.exec(text);
  if (!match?.[1]) {
    throw new Error("No JWT_SECRET in baseplate.env. Run `./scripts/dev init` first.");
  }
  return match[1].trim();
}

async function insert(table: string, token: string, body: string): Promise<Row> {
  const response = await fetch(`${BASE_URL}/${table}`, {
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
    throw new Error(`insert into ${table} answered ${String(response.status)}: ${text}`);
  }
  const row = (JSON.parse(text) as Row[])[0];
  if (!row) {
    throw new Error(`the insert into ${table} returned no row`);
  }
  return row;
}

/** Every row this token can see, newest first, as plain strings. */
async function bodies(table: string, token: string): Promise<string[]> {
  const response = await fetch(`${BASE_URL}/${table}`, {
    headers: { authorization: `Bearer ${token}` },
  });
  const text = await response.text();
  if (response.status !== 200) {
    throw new Error(`select from ${table} answered ${String(response.status)}: ${text}`);
  }
  return (JSON.parse(text) as Row[]).map((row) => row.body);
}

/** The same read with no Authorization header, which is the anon role. */
function read(table: string): Promise<Response> {
  return fetch(`${BASE_URL}/${table}`);
}
