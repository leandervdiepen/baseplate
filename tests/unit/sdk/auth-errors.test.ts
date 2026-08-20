import { afterEach, expect, test } from "vitest";
import { createClient, memoryStorage } from "../../../sdk/src/index.ts";

const originalFetch = globalThis.fetch;
const user = { id: "11111111-1111-4111-8111-111111111111", email: "you@example.com" };

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function reply(status: number, body: unknown): void {
  globalThis.fetch = (async () =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    })) as typeof fetch;
}

function client() {
  return createClient("http://api.test", { storage: memoryStorage(), autoRefresh: false });
}

test("a wrong password comes back as an error, not a throw", async () => {
  reply(401, { code: "auth.invalid_credentials", message: "Email or password is wrong." });

  const { data, error } = await client().auth.signIn({
    email: user.email,
    password: "not-the-password",
  });

  expect(data).toEqual({ user: null, session: null });
  expect(error?.status).toBe(401);
  expect(error?.code).toBe("auth.invalid_credentials");
  expect(error?.message).toBe("Email or password is wrong.");
});

test("a server that cannot be reached reports status 0", async () => {
  globalThis.fetch = (async () => {
    throw new TypeError("fetch failed");
  }) as typeof fetch;

  const { error } = await client().auth.signIn({ email: user.email, password: "a-long-password" });

  expect(error?.status).toBe(0);
  expect(error?.code).toBe("network_error");
  expect(error?.message).toContain("http://api.test");
});

test("a signup waiting on email confirmation has a user and no session", async () => {
  reply(201, { user: { ...user, emailConfirmedAt: null } });
  const signed = client();

  const { data, error } = await signed.auth.signUp({
    email: user.email,
    password: "a-long-password",
  });

  expect(error).toBeNull();
  expect(data.user?.email).toBe(user.email);
  expect(data.session).toBeNull();
  expect(signed.auth.getSession()).toBeNull();
  expect(signed.auth.getToken()).toBeUndefined();
});

test("getUser while signed out answers session_missing instead of throwing", async () => {
  reply(200, { user });

  const { data, error } = await client().auth.getUser();

  expect(data).toEqual({ user: null });
  expect(error?.code).toBe("session_missing");
  expect(error?.status).toBe(401);
});

test("resetPasswordForEmail says nothing about whether the address is known", async () => {
  reply(200, { ok: true });

  const { data, error } = await client().auth.resetPasswordForEmail("stranger@example.com");

  expect(error).toBeNull();
  expect(data).toEqual({});
});

test("changing the password adopts the fresh session it comes back with", async () => {
  const paths: string[] = [];
  globalThis.fetch = (async (input: string | URL) => {
    const path = String(input).replace("http://api.test", "");
    paths.push(path);
    const nth = path === "/auth/login" ? 1 : 2;
    return new Response(
      JSON.stringify({
        token: `access.${nth}`,
        refreshToken: `refresh.${nth}`,
        expiresIn: 3600,
        user,
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  }) as typeof fetch;
  const signed = client();
  const events: string[] = [];
  signed.auth.onAuthStateChange((event) => events.push(event));
  await signed.auth.signIn({ email: user.email, password: "a-long-password" });

  const { data, error } = await signed.auth.updateUser({
    currentPassword: "a-long-password",
    password: "a-longer-password",
  });

  expect(error).toBeNull();
  expect(data.session?.token).toBe("access.2");
  expect(paths).toEqual(["/auth/login", "/auth/password"]);
  expect(events).toEqual(["INITIAL_SESSION", "SIGNED_IN", "USER_UPDATED"]);
});

test("a recovery token trades for a session and signs the user in", async () => {
  reply(200, { token: "access.reset", refreshToken: "refresh.reset", expiresIn: 3600, user });
  const signed = client();
  const events: string[] = [];
  signed.auth.onAuthStateChange((event) => events.push(event));

  const { data, error } = await signed.auth.confirmPasswordReset({
    token: "one-time",
    password: "a-longer-password",
  });

  expect(error).toBeNull();
  expect(data.session?.token).toBe("access.reset");
  expect(signed.auth.getToken()).toBe("access.reset");
  expect(events).toEqual(["INITIAL_SESSION", "SIGNED_IN"]);
});
