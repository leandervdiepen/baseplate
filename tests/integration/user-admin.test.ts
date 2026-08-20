import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { afterAll, beforeAll, expect, test } from "vitest";
import { PostgresUserAdmin } from "#infrastructure";
import type { AdminUser, UserAdmin } from "#application";
import {
  authPost,
  bootStack,
  downStack,
  login,
  readCode,
  readSession,
  stackEnv,
} from "./support/stack.ts";

/**
 * `PostgresUserAdmin` is the operator's door into the same rows the auth
 * service serves the app through. Nothing unit-testable proves the two agree,
 * so this drives the port against a live database and then checks the effect
 * over HTTP: a password the operator set has to sign in, and a session the
 * operator revoked has to be gone.
 */
const PASSWORD = "correct horse battery staple";
const NEXT_PASSWORD = "a-different-long-password";
const THIRD_PASSWORD = "one-more-long-password";
/** Where a recovery link points. The app dev serves that page, not Baseplate. */
const SITE_URL = "http://localhost:3000";

let startedHere = false;
let admin: UserAdmin;
let sql: postgres.Sql;

beforeAll(async () => {
  startedHere = await bootStack();
});

beforeAll(() => {
  const port = Number(stackEnv("POSTGRES_PORT", "5432")) || 5432;
  const password = stackEnv("POSTGRES_PASSWORD");
  admin = new PostgresUserAdmin({ host: "127.0.0.1", port, database: "app", password });
  sql = postgres({
    host: "127.0.0.1",
    port,
    database: "app",
    username: "postgres",
    password,
    max: 1,
    onnotice: () => undefined,
  });
});

afterAll(async () => {
  // Optional: when the stack failed to come up the hook below never ran, and a
  // TypeError here would hide the reason.
  await admin?.close();
  await sql?.end();
  await downStack(startedHere);
});

test("a user the operator creates can sign in with those credentials", async () => {
  const created = await makeUser();

  const session = await readSession(await login(created.email, PASSWORD));

  expect(session.user.id).toBe(created.id);
  expect(session.user.email).toBe(created.email);
  // `confirmed` was asked for, so there is nothing left for them to confirm.
  expect(created.emailConfirmedAt).toBeTruthy();
});

test("the list finds a user by a fragment of their address", async () => {
  const created = await makeUser();

  const fragment = created.email.slice(0, created.email.indexOf("@"));
  const found = await admin.listUsers({ search: fragment, limit: 50, offset: 0 });

  expect(found.users.map((user) => user.id)).toContain(created.id);
  expect(found.total).toBeGreaterThanOrEqual(1);
  // The count is how many match, not how many came back, or the pager lies.
  expect(found.total).toBeGreaterThanOrEqual(found.users.length);
});

test("an address nobody holds matches nobody", async () => {
  const found = await admin.listUsers({ search: randomUUID(), limit: 50, offset: 0 });

  expect(found.users).toEqual([]);
  expect(found.total).toBe(0);
});

/**
 * A password that changes without ending the old sessions has not really
 * changed: whoever knew the last one is still signed in.
 */
test("setting a password revokes the sessions it replaces", async () => {
  const created = await makeUser();
  const session = await readSession(await login(created.email, PASSWORD));

  await admin.setPassword(created.id, NEXT_PASSWORD);

  const replay = await authPost("/auth/refresh", { refreshToken: session.refreshToken });
  expect(replay.status).toBe(401);
  const refused = await login(created.email, PASSWORD);
  expect(refused.status).toBe(401);
  expect(await readCode(refused)).toBe("auth.invalid_credentials");
  const renewed = await readSession(await login(created.email, NEXT_PASSWORD));
  expect(renewed.user.id).toBe(created.id);
});

test("revoking sessions kills the refresh token without touching the password", async () => {
  const created = await makeUser();
  const session = await readSession(await login(created.email, PASSWORD));

  expect(await admin.revokeSessions(created.id)).toBeGreaterThanOrEqual(1);

  const replay = await authPost("/auth/refresh", { refreshToken: session.refreshToken });
  expect(replay.status).toBe(401);
  // Revoking is not a lockout. The password they know still works.
  const again = await readSession(await login(created.email, PASSWORD));
  expect(again.user.id).toBe(created.id);
  // Nothing left to revoke a second time except the session just made.
  expect(await admin.revokeSessions(created.id)).toBe(1);
});

test("the recovery link the operator hands over sets a new password", async () => {
  const created = await makeUser();

  const { link, expiresAt } = await admin.createRecoveryLink(created.id, SITE_URL);

  expect(link.startsWith(`${SITE_URL}/reset-password?token=`)).toBe(true);
  expect(Date.parse(expiresAt)).toBeGreaterThan(Date.now());
  const token = new URL(link).searchParams.get("token") ?? "";
  expect(token.length).toBeGreaterThan(20);

  const confirmed = await authPost("/auth/recover/confirm", { token, password: THIRD_PASSWORD });
  const session = await readSession(confirmed);
  expect(session.user.id).toBe(created.id);
  const signedIn = await readSession(await login(created.email, THIRD_PASSWORD));
  expect(signedIn.user.id).toBe(created.id);
});

test("handing out a second recovery link retires the first", async () => {
  const created = await makeUser();

  const first = await admin.createRecoveryLink(created.id, SITE_URL);
  await admin.createRecoveryLink(created.id, SITE_URL);

  const stale = new URL(first.link).searchParams.get("token") ?? "";
  const response = await authPost("/auth/recover/confirm", {
    token: stale,
    password: THIRD_PASSWORD,
  });
  expect(response.status).toBe(401);
  expect(await readCode(response)).toBe("auth.invalid_reset_token");
});

test("deleting a user removes the row and the tokens hanging off it", async () => {
  const created = await makeUser();
  await readSession(await login(created.email, PASSWORD));
  await admin.createRecoveryLink(created.id, SITE_URL);
  expect(await countRefreshTokens(created.id)).toBeGreaterThanOrEqual(1);
  expect(await countOneTimeTokens(created.id)).toBe(1);

  expect(await admin.deleteUser(created.id)).toBe(true);

  expect(await countRefreshTokens(created.id)).toBe(0);
  expect(await countOneTimeTokens(created.id)).toBe(0);
  const found = await admin.listUsers({ search: created.email, limit: 50, offset: 0 });
  expect(found.users).toEqual([]);
  expect((await login(created.email, PASSWORD)).status).toBe(401);
  // Nothing to delete the second time, and no error either.
  expect(await admin.deleteUser(created.id)).toBe(false);
});

test("an address that is already taken is refused by name", async () => {
  const created = await makeUser();

  await expect(admin.createUser(created.email, PASSWORD, true)).rejects.toMatchObject({
    code: "users.email_taken",
  });
});

/** One per test, so no test can be broken by another one's rate limit budget. */
async function makeUser(): Promise<AdminUser> {
  return await admin.createUser(`admin-${randomUUID().slice(0, 8)}@example.com`, PASSWORD, true);
}

async function countRefreshTokens(userId: string): Promise<number> {
  const rows = await sql<{ n: number }[]>`
    SELECT count(*)::int AS n FROM auth.refresh_tokens WHERE user_id = ${userId}`;
  return rows[0]?.n ?? -1;
}

async function countOneTimeTokens(userId: string): Promise<number> {
  const rows = await sql<{ n: number }[]>`
    SELECT count(*)::int AS n FROM auth.one_time_tokens WHERE user_id = ${userId}`;
  return rows[0]?.n ?? -1;
}
