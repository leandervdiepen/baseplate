import { afterEach, beforeEach, expect, test } from "vitest";
import {
  createClient,
  SESSION_KEY,
  type AuthChangeEvent,
  type AuthSession,
  type SessionStorage,
} from "../../../sdk/src/index.ts";

const originalFetch = globalThis.fetch;
const user = { id: "11111111-1111-4111-8111-111111111111", email: "you@example.com" };
let authCalls: string[] = [];
let bearers: (string | null)[] = [];

/** localStorage as two tabs see it: `write` is the other tab, event included. */
function sharedStorage() {
  const map = new Map<string, string>();
  let listener: ((raw: string | null) => void) | undefined;
  const storage: SessionStorage = {
    get: (key) => map.get(key) ?? null,
    set: (key, value) => {
      map.set(key, value);
    },
    remove: (key) => {
      map.delete(key);
    },
    onExternalChange: (next) => {
      listener = next;
      return () => {
        listener = undefined;
      };
    },
  };
  return {
    storage,
    raw: () => map.get(SESSION_KEY) ?? null,
    /** Another tab writes the session, or clears it when given `null`. */
    write(session: AuthSession | null) {
      const raw = session ? JSON.stringify(session) : null;
      if (raw === null) {
        map.delete(SESSION_KEY);
      } else {
        map.set(SESSION_KEY, raw);
      }
      listener?.(raw);
      return raw;
    },
  };
}

function session(nth: number, secondsLeft: number): AuthSession {
  return {
    token: `access.${nth}`,
    refreshToken: `refresh.${nth}`,
    expiresIn: secondsLeft,
    expiresAt: Date.now() + secondsLeft * 1000,
    user,
  };
}

beforeEach(() => {
  authCalls = [];
  bearers = [];
  globalThis.fetch = (async (input: string | URL, init?: RequestInit) => {
    const path = String(input).replace("http://api.test", "");
    if (path.startsWith("/auth/")) {
      authCalls.push(path);
      return new Response(
        JSON.stringify({
          token: "access.9",
          refreshToken: "refresh.9",
          expiresIn: 3600,
          user,
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }
    bearers.push(new Headers(init?.headers).get("authorization"));
    return new Response("[]", { status: 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

test("a session another tab refreshed is adopted, not written back", async () => {
  const shared = sharedStorage();
  shared.storage.set(SESSION_KEY, JSON.stringify(session(1, 3600)));
  const client = createClient("http://api.test", { storage: shared.storage, autoRefresh: false });
  const events: AuthChangeEvent[] = [];
  client.auth.onAuthStateChange((event) => events.push(event));
  await Promise.resolve();

  const written = shared.write(session(2, 3600));
  await client.from("items").select();

  expect(client.auth.getSession()?.token).toBe("access.2");
  expect(shared.raw()).toBe(written);
  expect(bearers).toEqual(["Bearer access.2"]);
  expect(authCalls).toEqual([]);
  expect(events).toEqual(["INITIAL_SESSION", "TOKEN_REFRESHED"]);
});

test("a tab that signs in hands the session to the tabs that had none", async () => {
  const shared = sharedStorage();
  const client = createClient("http://api.test", { storage: shared.storage, autoRefresh: false });
  const events: AuthChangeEvent[] = [];
  client.auth.onAuthStateChange((event) => events.push(event));
  await Promise.resolve();

  shared.write(session(1, 3600));

  expect(events).toEqual(["INITIAL_SESSION", "SIGNED_IN"]);
  expect(client.auth.getToken()).toBe("access.1");
});

test("a tab that signs out signs the others out", async () => {
  const shared = sharedStorage();
  shared.storage.set(SESSION_KEY, JSON.stringify(session(1, 3600)));
  const client = createClient("http://api.test", { storage: shared.storage, autoRefresh: false });
  const events: AuthChangeEvent[] = [];
  client.auth.onAuthStateChange((event) => events.push(event));
  await Promise.resolve();

  shared.write(null);
  await client.from("items").select();

  expect(events).toEqual(["INITIAL_SESSION", "SIGNED_OUT"]);
  expect(client.auth.getSession()).toBeNull();
  expect(bearers).toEqual([null]);
});

test("an expired token spends nothing when storage already holds a newer session", async () => {
  const shared = sharedStorage();
  shared.storage.set(SESSION_KEY, JSON.stringify(session(1, 5)));
  const client = createClient("http://api.test", { storage: shared.storage, autoRefresh: false });
  // Written without an event, the way a tab that was asleep finds it.
  shared.storage.set(SESSION_KEY, JSON.stringify(session(2, 3600)));

  const token = await client.auth.authorize();
  await client.from("items").select();

  expect(token).toBe("access.2");
  expect(authCalls).toEqual([]);
  expect(bearers).toEqual(["Bearer access.2"]);
});
