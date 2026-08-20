import { afterEach, beforeEach, expect, test } from "vitest";
import { createClient, memoryStorage } from "../../../sdk/src/index.ts";

const originalFetch = globalThis.fetch;
const user = { id: "11111111-1111-4111-8111-111111111111", email: "you@example.com" };
let bearers: (string | null)[] = [];
let authCalls: string[] = [];

type Plan = {
  /** The access token each successive /auth/refresh hands back. */
  refreshTo: string;
  /** How many data requests answer 401 before one succeeds. */
  rejections: number;
};

function serve(plan: Plan): void {
  let rejections = plan.rejections;
  globalThis.fetch = (async (input: string | URL, init?: RequestInit) => {
    const path = String(input).replace("http://api.test", "");
    if (path.startsWith("/auth/")) {
      authCalls.push(path);
      const token = path === "/auth/login" ? "access.1" : plan.refreshTo;
      return new Response(
        JSON.stringify({ token, refreshToken: `refresh.${token}`, expiresIn: 3600, user }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }
    bearers.push(new Headers(init?.headers).get("authorization"));
    if (rejections > 0) {
      rejections -= 1;
      return new Response(JSON.stringify({ message: "JWT expired." }), {
        status: 401,
        headers: { "content-type": "application/json" },
      });
    }
    return new Response(JSON.stringify([{ id: "1", owner_id: user.id, body: "hi" }]), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;
}

async function signedIn() {
  const client = createClient("http://api.test", {
    storage: memoryStorage(),
    autoRefresh: false,
  });
  await client.auth.signIn({ email: user.email, password: "a-long-password" });
  return client;
}

beforeEach(() => {
  bearers = [];
  authCalls = [];
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

test("a 401 refreshes once and replays the request with the new token", async () => {
  serve({ refreshTo: "access.2", rejections: 1 });
  const client = await signedIn();

  const { data, error } = await client.from("items").select();

  expect(error).toBeNull();
  expect(data?.[0]?.body).toBe("hi");
  expect(bearers).toEqual(["Bearer access.1", "Bearer access.2"]);
  expect(authCalls).toEqual(["/auth/login", "/auth/refresh"]);
});

test("a refresh that hands back the same token does not replay", async () => {
  serve({ refreshTo: "access.1", rejections: 1 });
  const client = await signedIn();

  const { error, status } = await client.from("items").select();

  expect(status).toBe(401);
  expect(error?.message).toBe("JWT expired.");
  expect(bearers).toEqual(["Bearer access.1"]);
  expect(authCalls).toEqual(["/auth/login", "/auth/refresh"]);
});

test("a second 401 surfaces instead of looping", async () => {
  serve({ refreshTo: "access.2", rejections: 2 });
  const client = await signedIn();

  const { error, status } = await client.from("items").select();

  expect(status).toBe(401);
  expect(error?.message).toBe("JWT expired.");
  expect(bearers).toEqual(["Bearer access.1", "Bearer access.2"]);
  expect(authCalls).toEqual(["/auth/login", "/auth/refresh"]);
});

test("storage uploads get the same one retry", async () => {
  serve({ refreshTo: "access.2", rejections: 1 });
  const client = await signedIn();

  const { error } = await client.storage.from("shots").remove("a.png");

  expect(error).toBeNull();
  expect(bearers).toEqual(["Bearer access.1", "Bearer access.2"]);
});
