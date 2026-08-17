import { afterEach, expect, test } from "vitest";
import { createClient } from "../../../sdk/src/index.ts";

afterEach(() => {
  globalThis.fetch = originalFetch;
});

const originalFetch = globalThis.fetch;

test("signUp stores the JWT and select sends it", async () => {
  const calls: { url: string; auth: string | null }[] = [];
  globalThis.fetch = (async (input: string | URL, init?: RequestInit) => {
    const url = String(input);
    const headers = new Headers(init?.headers);
    calls.push({ url, auth: headers.get("authorization") });
    if (url.endsWith("/auth/signup")) {
      return new Response(
        JSON.stringify({
          token: "jwt.token",
          user: { id: "11111111-1111-4111-8111-111111111111", email: "you@example.com" },
        }),
        { status: 201, headers: { "content-type": "application/json" } },
      );
    }
    return new Response(JSON.stringify([{ id: "1", owner_id: "11111111-1111-4111-8111-111111111111", body: "hi" }]), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;

  const client = createClient("http://127.0.0.1:8080");
  await client.auth.signUp({ email: "you@example.com", password: "a-long-password" });
  const { data, error } = await client.from("items").select();
  expect(error).toBeNull();
  expect(data?.[0]?.body).toBe("hi");
  expect(calls[1]?.auth).toBe("Bearer jwt.token");
});
