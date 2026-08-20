import { afterEach, expect, test } from "vitest";
import {
  createClient,
  memoryStorage,
  SESSION_KEY,
  type AuthChangeEvent,
  type SessionStorage,
} from "../../../sdk/src/index.ts";

const originalFetch = globalThis.fetch;
const user = { id: "11111111-1111-4111-8111-111111111111", email: "you@example.com" };

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function sessionBody(nth: number, expiresIn: number): string {
  return JSON.stringify({
    token: `access.${nth}`,
    refreshToken: `refresh.${nth}`,
    expiresIn,
    user,
  });
}

/** Signs in with a token that is already inside the refresh margin. */
async function signedIn(storage: SessionStorage, onRefresh: () => Response) {
  globalThis.fetch = (async (input: string | URL) => {
    if (String(input).endsWith("/auth/refresh")) {
      return onRefresh();
    }
    return new Response(sessionBody(1, 10), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;
  const client = createClient("http://api.test", { storage, autoRefresh: false });
  const events: AuthChangeEvent[] = [];
  client.auth.onAuthStateChange((event) => events.push(event));
  await client.auth.signIn({ email: user.email, password: "a-long-password" });
  return { client, events };
}

test("a refresh that never reaches the server keeps the session", async () => {
  const { client, events } = await signedIn(memoryStorage(), () => {
    throw new TypeError("fetch failed");
  });

  const { data, error } = await client.auth.refreshSession();

  expect(error?.status).toBe(0);
  expect(data.session?.token).toBe("access.1");
  expect(client.auth.getSession()?.token).toBe("access.1");
  expect(events).not.toContain("SIGNED_OUT");
  // The stale token is still the best one we have, so it is the one we send.
  expect(await client.auth.authorize()).toBe("access.1");
});

test("a server error during refresh keeps the session too", async () => {
  const { client, events } = await signedIn(
    memoryStorage(),
    () => new Response("gateway", { status: 502 }),
  );

  const { error } = await client.auth.refreshSession();

  expect(error?.status).toBe(502);
  expect(client.auth.getSession()?.token).toBe("access.1");
  expect(events).not.toContain("SIGNED_OUT");
});

test("a refresh token the server rejects signs the user out", async () => {
  const storage = memoryStorage();
  const { client, events } = await signedIn(
    storage,
    () =>
      new Response(
        JSON.stringify({
          code: "auth.invalid_refresh_token",
          message: "That session has expired. Sign in again.",
        }),
        { status: 401, headers: { "content-type": "application/json" } },
      ),
  );

  const { error } = await client.auth.refreshSession();

  expect(error?.code).toBe("auth.invalid_refresh_token");
  expect(client.auth.getSession()).toBeNull();
  expect(storage.get(SESSION_KEY)).toBeNull();
  expect(events).toEqual(["INITIAL_SESSION", "SIGNED_IN", "SIGNED_OUT"]);
});

test("losing the refresh race to another tab adopts their session instead of signing out", async () => {
  const storage = memoryStorage();
  const { client, events } = await signedIn(storage, () => {
    // The other tab spent our refresh token first and wrote what it got back.
    storage.set(
      SESSION_KEY,
      JSON.stringify({
        token: "access.2",
        refreshToken: "refresh.2",
        expiresIn: 3600,
        expiresAt: Date.now() + 3_600_000,
        user,
      }),
    );
    return new Response(JSON.stringify({ code: "auth.invalid_refresh_token", message: "Gone." }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  });

  const { data, error } = await client.auth.refreshSession();

  expect(error).toBeNull();
  expect(data.session?.token).toBe("access.2");
  expect(client.auth.getSession()?.refreshToken).toBe("refresh.2");
  expect(events).toEqual(["INITIAL_SESSION", "SIGNED_IN", "TOKEN_REFRESHED"]);
});
