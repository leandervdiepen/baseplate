import { afterEach, beforeEach, expect, test, vi } from "vitest";
import {
  createClient,
  memoryStorage,
  type AuthChangeEvent,
  type SessionStorage,
} from "../../../sdk/src/index.ts";

const originalFetch = globalThis.fetch;
const user = { id: "11111111-1111-4111-8111-111111111111", email: "you@example.com" };
let issued = 0;
let authCalls: string[] = [];
let bearers: (string | null)[] = [];

function sessionBody(expiresIn: number) {
  issued += 1;
  return JSON.stringify({
    token: `access.${issued}`,
    refreshToken: `refresh.${issued}`,
    expiresIn,
    user,
  });
}

function serve(expiresIn: number): void {
  globalThis.fetch = (async (input: string | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes("/auth/")) {
      authCalls.push(url.replace("http://api.test", ""));
      return new Response(sessionBody(expiresIn), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    bearers.push(new Headers(init?.headers).get("authorization"));
    return new Response("[]", { status: 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
}

beforeEach(() => {
  issued = 0;
  authCalls = [];
  bearers = [];
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.useRealTimers();
});

test("a signed-in session survives a new client on the same storage", async () => {
  const storage: SessionStorage = memoryStorage();
  serve(3600);

  await createClient("http://api.test", { storage }).auth.signIn({
    email: user.email,
    password: "a-long-password",
  });
  const revived = createClient("http://api.test", { storage });

  expect(revived.auth.getSession()?.user.email).toBe(user.email);
  await revived.from("items").select();
  expect(bearers).toEqual(["Bearer access.1"]);
});

test("nothing is stored when persistence is off", async () => {
  const storage = memoryStorage();
  serve(3600);

  await createClient("http://api.test", { storage, persist: false }).auth.signIn({
    email: user.email,
    password: "a-long-password",
  });

  expect(createClient("http://api.test", { storage }).auth.getSession()).toBeNull();
});

test("an expiring access token refreshes before the next query", async () => {
  serve(10);
  const client = createClient("http://api.test", {
    storage: memoryStorage(),
    autoRefresh: false,
  });
  await client.auth.signIn({ email: user.email, password: "a-long-password" });

  await client.from("items").select();

  expect(authCalls).toEqual(["/auth/login", "/auth/refresh"]);
  expect(bearers).toEqual(["Bearer access.2"]);
});

test("a live access token is reused rather than refreshed", async () => {
  serve(3600);
  const client = createClient("http://api.test", { storage: memoryStorage() });
  await client.auth.signIn({ email: user.email, password: "a-long-password" });

  await client.from("items").select();
  await client.from("items").select();

  expect(authCalls).toEqual(["/auth/login"]);
  expect(bearers).toEqual(["Bearer access.1", "Bearer access.1"]);
});

test("concurrent queries on an expiring token refresh once", async () => {
  serve(10);
  const client = createClient("http://api.test", {
    storage: memoryStorage(),
    autoRefresh: false,
  });
  await client.auth.signIn({ email: user.email, password: "a-long-password" });

  await Promise.all([client.from("items").select(), client.from("items").select()]);

  expect(authCalls).toEqual(["/auth/login", "/auth/refresh"]);
});

test("the background timer refreshes before the token expires", async () => {
  vi.useFakeTimers();
  serve(600);
  const client = createClient("http://api.test", { storage: memoryStorage() });
  await client.auth.signIn({ email: user.email, password: "a-long-password" });

  await vi.advanceTimersByTimeAsync(600_000);

  expect(authCalls).toEqual(["/auth/login", "/auth/refresh"]);
  expect(client.auth.getSession()?.token).toBe("access.2");
});

test("signing out clears storage and stops sending a token", async () => {
  const storage = memoryStorage();
  serve(3600);
  const client = createClient("http://api.test", { storage });
  await client.auth.signIn({ email: user.email, password: "a-long-password" });

  await client.auth.signOut();
  await client.from("items").select();

  expect(client.auth.getSession()).toBeNull();
  expect(createClient("http://api.test", { storage }).auth.getSession()).toBeNull();
  expect(bearers).toEqual([null]);
});

test("subscribers hear the session they started with, then sign in and sign out", async () => {
  serve(3600);
  const client = createClient("http://api.test", { storage: memoryStorage() });
  const seen: [AuthChangeEvent, string | undefined][] = [];
  const unsubscribe = client.auth.onAuthStateChange((event, session) => {
    seen.push([event, session?.user.email]);
  });

  await client.auth.signIn({ email: user.email, password: "a-long-password" });
  await client.auth.signOut();
  unsubscribe();
  await client.auth.signIn({ email: user.email, password: "a-long-password" });

  expect(seen).toEqual([
    ["INITIAL_SESSION", undefined],
    ["SIGNED_IN", user.email],
    ["SIGNED_OUT", undefined],
  ]);
});
