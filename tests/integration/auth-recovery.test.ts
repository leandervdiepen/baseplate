import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, expect, test } from "vitest";
import { messagesFor, waitForRecoveryToken } from "./support/mailpit.ts";
import {
  authPost,
  bootStack,
  downStack,
  ensureItemsTable,
  listItems,
  login,
  me,
  postItem,
  readCode,
  readSession,
  signUp,
  sleep,
  type Session,
} from "./support/stack.ts";

/**
 * Password reset is the one flow whose secret never appears in an HTTP
 * response, so proving it works means reading the inbox the user would read.
 * Mailpit is that inbox in the local stack.
 *
 * The round trip happens once, in `beforeAll`, because it costs a real email
 * and the sender limit is three an hour per address. The tests below then say
 * one thing each about what it left behind.
 */
const PASSWORD_BEFORE = "correct horse battery staple";
const PASSWORD_AFTER = "a-different-long-password";

/** Unique per run so a rerun collides with neither the rate limits nor the unique index. */
const EMAIL = `recover-${randomUUID().slice(0, 8)}@example.com`;

let startedHere = false;
let before: Session;
let after: Session;
let spentToken = "";
let ownedRow = "";

beforeAll(async () => {
  startedHere = await bootStack();
});

beforeAll(ensureItemsTable);

beforeAll(async () => {
  before = await signUp(EMAIL, PASSWORD_BEFORE);
  ownedRow = `before-reset-${randomUUID().slice(0, 8)}`;
  await postItem(before.token, ownedRow);

  const asked = await authPost("/auth/recover", { email: EMAIL });
  expect(asked.status, await asked.text()).toBe(200);

  spentToken = await waitForRecoveryToken(EMAIL);
  const confirmed = await authPost("/auth/recover/confirm", {
    token: spentToken,
    password: PASSWORD_AFTER,
  });
  after = await readSession(confirmed);
});

afterAll(async () => {
  await downStack(startedHere);
});

test("the session the reset hands back belongs to the same person, rows and all", async () => {
  expect(after.user.id).toBe(before.user.id);
  expect(after.user.email).toBe(EMAIL);
  expect(after.token).not.toBe(before.token);

  // A session that cannot read the rows the account already owns is not a
  // session, whatever the response body says.
  const rows = await listItems(after.token);
  expect(rows.some((row) => row.body === ownedRow)).toBe(true);
});

test("the old password stops working", async () => {
  const response = await login(EMAIL, PASSWORD_BEFORE);
  expect(response.status).toBe(401);
  expect(await readCode(response)).toBe("auth.invalid_credentials");
});

/**
 * Whoever needed a reset may be recovering from someone else holding the old
 * password, so the sessions that password bought have to die with it.
 */
test("the refresh token that existed before the reset is dead", async () => {
  const response = await authPost("/auth/refresh", { refreshToken: before.refreshToken });
  expect(response.status).toBe(401);
  expect(await readCode(response)).toBe("auth.invalid_refresh_token");

  // The one the reset issued is live, which is why the caller stays signed in.
  const renewed = await authPost("/auth/refresh", { refreshToken: after.refreshToken });
  expect(renewed.status, await renewed.text()).toBe(200);
});

test("the new password signs in", async () => {
  const session = await readSession(await login(EMAIL, PASSWORD_AFTER));
  expect(session.user.id).toBe(before.user.id);
});

test("a fresh sign-in can read its own account, timestamps and all", async () => {
  const session = await readSession(await login(EMAIL, PASSWORD_AFTER));

  const user = await me(session.token);
  expect(user.id).toBe(before.user.id);
  expect(user.email).toBe(EMAIL);
  expect(Date.parse(user.createdAt)).toBeGreaterThan(0);
  // Set by the login that just happened, so it must be there and be recent.
  expect(user.lastSignInAt).toBeTruthy();
  expect(Date.now() - Date.parse(user.lastSignInAt ?? "")).toBeLessThan(60_000);
  // Receiving the mail proved the address as well as a verify link would.
  expect(user.emailConfirmedAt).toBeTruthy();
});

test("a spent recovery token cannot be spent again", async () => {
  const response = await authPost("/auth/recover/confirm", {
    token: spentToken,
    password: "yet-another-long-password",
  });

  expect(response.status).toBe(401);
  expect(await readCode(response)).toBe("auth.invalid_reset_token");
});

test("a token nobody ever issued is refused the same way", async () => {
  const response = await authPost("/auth/recover/confirm", {
    token: randomUUID(),
    password: "yet-another-long-password",
  });

  expect(response.status).toBe(401);
  expect(await readCode(response)).toBe("auth.invalid_reset_token");
});

/**
 * The forgot-password form must not become a list of everybody who uses the
 * app, so an address with no account gets the same 200 - and no mail, which is
 * the other half of the same answer.
 */
test("an address with no account is answered exactly the same way", async () => {
  const unknown = `nobody-${randomUUID().slice(0, 8)}@example.com`;

  const response = await authPost("/auth/recover", { email: unknown });
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ ok: true });

  // Delivery is best-effort and not awaited, so give it the same grace the
  // real one gets before concluding nothing was sent.
  await sleep(2_000);
  expect(await messagesFor(unknown)).toEqual([]);
});
