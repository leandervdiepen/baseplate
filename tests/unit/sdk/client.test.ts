import { afterEach, expect, test } from "vitest";
import { createClient } from "../../../sdk/src/index.ts";

afterEach(() => {
  globalThis.fetch = originalFetch;
});

const originalFetch = globalThis.fetch;
const user = { id: "11111111-1111-4111-8111-111111111111", email: "you@example.com" };

test("signUp returns the session and select sends its JWT", async () => {
  const calls: { url: string; auth: string | null }[] = [];
  globalThis.fetch = (async (input: string | URL, init?: RequestInit) => {
    const url = String(input);
    const headers = new Headers(init?.headers);
    calls.push({ url, auth: headers.get("authorization") });
    if (url.endsWith("/auth/signup")) {
      return new Response(
        JSON.stringify({ token: "jwt.token", refreshToken: "refresh.1", expiresIn: 3600, user }),
        { status: 201, headers: { "content-type": "application/json" } },
      );
    }
    return new Response(JSON.stringify([{ id: "1", owner_id: user.id, body: "hi" }]), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;

  const client = createClient("http://127.0.0.1:8080");
  const signUp = await client.auth.signUp({ email: user.email, password: "a-long-password" });
  expect(signUp.error).toBeNull();
  expect(signUp.data.user?.email).toBe(user.email);
  expect(signUp.data.session?.token).toBe("jwt.token");

  const { data, error } = await client.from("items").select();
  expect(error).toBeNull();
  expect(data?.[0]?.body).toBe("hi");
  expect(calls[1]?.auth).toBe("Bearer jwt.token");
});
