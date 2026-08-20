import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { beforeAll, expect, test } from "vitest";
import { resolve } from "node:path";

/**
 * Objects are rows with bytes attached, so the thing worth proving against a
 * real stack is the same thing `two-token.sh` proves for rows: two callers,
 * one bucket, and nothing of each other's.
 */
const ROOT = resolve(import.meta.dirname, "../..");
const BASE_URL = "http://127.0.0.1:8080";
const PASSWORD = "correct horse battery staple";

const PRIVATE_BUCKET = `it-private-${randomUUID().slice(0, 8)}`;
const PUBLIC_BUCKET = `it-public-${randomUUID().slice(0, 8)}`;

let alice = "";
let bob = "";

beforeAll(async () => {
  await cli(["storage", "add-bucket", PRIVATE_BUCKET]);
  await cli(["storage", "add-bucket", PUBLIC_BUCKET, "--public"]);
  alice = await signIn(`alice-${randomUUID().slice(0, 8)}@example.com`);
  bob = await signIn(`bob-${randomUUID().slice(0, 8)}@example.com`);
});

test("a caller reads back what they put in", async () => {
  const put = await upload(alice, PRIVATE_BUCKET, "notes/one.txt", "alice wrote this");
  expect(put.status).toBe(201);

  const got = await fetch(`${BASE_URL}/storage/${PRIVATE_BUCKET}/notes/one.txt`, {
    headers: { authorization: `Bearer ${alice}` },
  });
  expect(await got.text()).toBe("alice wrote this");
});

test("another caller sees nothing of it, not even that it is there", async () => {
  const got = await fetch(`${BASE_URL}/storage/${PRIVATE_BUCKET}/notes/one.txt`, {
    headers: { authorization: `Bearer ${bob}` },
  });
  expect(got.status).toBe(404);

  const listed = await fetch(`${BASE_URL}/storage/${PRIVATE_BUCKET}`, {
    headers: { authorization: `Bearer ${bob}` },
  });
  expect(((await listed.json()) as { objects: unknown[] }).objects).toEqual([]);
});

/** The blob must not be touched before the row settles who owns the key. */
test("another caller cannot overwrite an object by taking its key", async () => {
  const put = await upload(bob, PRIVATE_BUCKET, "notes/one.txt", "bob overwrote this");
  expect(put.status).toBe(409);

  const got = await fetch(`${BASE_URL}/storage/${PRIVATE_BUCKET}/notes/one.txt`, {
    headers: { authorization: `Bearer ${alice}` },
  });
  expect(await got.text()).toBe("alice wrote this");
});

test("another caller cannot delete it either", async () => {
  const deleted = await fetch(`${BASE_URL}/storage/${PRIVATE_BUCKET}/notes/one.txt`, {
    method: "DELETE",
    headers: { authorization: `Bearer ${bob}` },
  });
  expect(deleted.status).toBe(404);
});

test("no token gets nothing", async () => {
  const got = await fetch(`${BASE_URL}/storage/${PRIVATE_BUCKET}/notes/one.txt`);
  expect(got.status).toBe(401);

  const put = await fetch(`${BASE_URL}/storage/${PRIVATE_BUCKET}/anon.txt`, {
    method: "PUT",
    body: "anonymous",
  });
  expect(put.status).toBe(401);
});

test("a tampered token gets nothing", async () => {
  const got = await fetch(`${BASE_URL}/storage/${PRIVATE_BUCKET}/notes/one.txt`, {
    headers: { authorization: `Bearer ${alice.slice(0, -2)}xy` },
  });
  expect(got.status).toBe(401);
});

test("a public bucket is readable by anyone signed in, and writable only by its owner", async () => {
  await upload(alice, PUBLIC_BUCKET, "shared.txt", "for everyone");

  const read = await fetch(`${BASE_URL}/storage/${PUBLIC_BUCKET}/shared.txt`, {
    headers: { authorization: `Bearer ${bob}` },
  });
  expect(read.status).toBe(200);
  expect(await read.text()).toBe("for everyone");

  const write = await upload(bob, PUBLIC_BUCKET, "shared.txt", "bob was here");
  expect(write.status).toBe(409);

  const removed = await fetch(`${BASE_URL}/storage/${PUBLIC_BUCKET}/shared.txt`, {
    method: "DELETE",
    headers: { authorization: `Bearer ${bob}` },
  });
  expect(removed.status).toBe(404);
});

test("a bucket the operator never made does not quietly appear", async () => {
  const put = await upload(alice, "no-such-bucket", "x.txt", "hello");
  expect(put.status).toBe(404);
});

test("a signed link opens one object, and only that one", async () => {
  const signed = await fetch(
    `${BASE_URL}/storage/${PRIVATE_BUCKET}/notes/one.txt?expiresIn=120`,
    { method: "PATCH", headers: { authorization: `Bearer ${alice}` } },
  );
  const { token } = (await signed.json()) as { token: string };

  const withLink = await fetch(
    `${BASE_URL}/storage/${PRIVATE_BUCKET}/notes/one.txt?token=${encodeURIComponent(token)}`,
  );
  expect(withLink.status).toBe(200);
  expect(await withLink.text()).toBe("alice wrote this");

  const elsewhere = await fetch(
    `${BASE_URL}/storage/${PUBLIC_BUCKET}/shared.txt?token=${encodeURIComponent(token)}`,
  );
  expect(elsewhere.status).toBe(403);
});

test("an upload larger than the stack allows is refused", async () => {
  const tooBig = "x".repeat(27 * 1024 * 1024);
  const put = await upload(alice, PRIVATE_BUCKET, "big.txt", tooBig);
  expect(put.status).toBe(413);
});

test("an object the caller removed is gone", async () => {
  await upload(alice, PRIVATE_BUCKET, "temp.txt", "here for a moment");
  const removed = await fetch(`${BASE_URL}/storage/${PRIVATE_BUCKET}/temp.txt`, {
    method: "DELETE",
    headers: { authorization: `Bearer ${alice}` },
  });
  expect(removed.status).toBe(200);

  const got = await fetch(`${BASE_URL}/storage/${PRIVATE_BUCKET}/temp.txt`, {
    headers: { authorization: `Bearer ${alice}` },
  });
  expect(got.status).toBe(404);
});

function upload(token: string, bucket: string, key: string, body: string): Promise<Response> {
  return fetch(`${BASE_URL}/storage/${bucket}/${key}`, {
    method: "PUT",
    headers: { authorization: `Bearer ${token}`, "content-type": "text/plain" },
    body,
  });
}

async function signIn(email: string): Promise<string> {
  const response = await fetch(`${BASE_URL}/auth/signup`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  return ((await response.json()) as { token: string }).token;
}

function cli(args: string[]): Promise<void> {
  return new Promise((done, fail) => {
    const child = spawn("./scripts/dev", args, { cwd: ROOT, stdio: "ignore" });
    child.on("error", fail);
    child.on("exit", (code) => (code === 0 ? done() : fail(new Error(`dev ${args[0]} exited ${String(code)}`))));
  });
}
