import { afterEach, beforeEach, expect, test } from "vitest";
import { createClient, memoryStorage } from "../../../sdk/src/index.ts";

const originalFetch = globalThis.fetch;
let calls: { url: string; method: string; body: string | null; headers: Headers }[] = [];

beforeEach(() => {
  calls = [];
  globalThis.fetch = (async (input: string | URL, init?: RequestInit) => {
    calls.push({
      url: String(input),
      method: init?.method ?? "GET",
      body: typeof init?.body === "string" ? init.body : null,
      headers: new Headers(init?.headers),
    });
    return new Response(JSON.stringify([]), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function client() {
  return createClient("http://api.test", { storage: memoryStorage() });
}

/** URLSearchParams writes a space as `+`, which servers read back as a space. */
function lastUrl(): string {
  return decodeURIComponent((calls[calls.length - 1]?.url ?? "").replaceAll("+", " "));
}

test("filters become PostgREST query parameters", async () => {
  await client().from("items").select().eq("body", "hello").gte("id", 3);

  expect(lastUrl()).toBe("http://api.test/items?body=eq.hello&id=gte.3");
});

test("a scalar value is sent unquoted, because PostgREST reads quotes literally", async () => {
  await client().from("items").select().eq("body", "one, two");

  expect(lastUrl()).toBe("http://api.test/items?body=eq.one, two");
});

test("in takes a list", async () => {
  await client().from("items").select().in("id", ["a", "b"]);

  expect(lastUrl()).toBe("http://api.test/items?id=in.(a,b)");
});

test("a comma inside an in list is quoted so it stays one value", async () => {
  await client().from("items").select().in("body", ["one, two", "three"]);

  expect(lastUrl()).toBe('http://api.test/items?body=in.("one, two",three)');
});

test("is null does not become the string null", async () => {
  await client().from("items").select().is("body", null);

  expect(lastUrl()).toBe("http://api.test/items?body=is.null");
});

test("order, limit, offset, and a column list travel together", async () => {
  await client()
    .from("items")
    .select("id,body")
    .order("body", { ascending: false })
    .limit(10)
    .offset(20);

  expect(lastUrl()).toBe(
    "http://api.test/items?select=id,body&order=body.desc&limit=10&offset=20",
  );
});

test("update sends PATCH with the filter and asks for the rows back", async () => {
  await client().from("items").update({ body: "next" }).eq("id", "1");

  const call = calls[calls.length - 1];
  expect(call?.method).toBe("PATCH");
  expect(call?.body).toBe('{"body":"next"}');
  expect(call?.headers.get("prefer")).toBe("return=representation");
  expect(lastUrl()).toBe("http://api.test/items?id=eq.1");
});

test("delete sends DELETE with the filter", async () => {
  await client().from("items").delete().eq("id", "1");

  expect(calls[calls.length - 1]?.method).toBe("DELETE");
  expect(lastUrl()).toBe("http://api.test/items?id=eq.1");
});

test("single asks PostgREST for one object rather than an array", async () => {
  await client().from("items").select().eq("id", "1").single();

  expect(calls[calls.length - 1]?.headers.get("accept")).toBe(
    "application/vnd.pgrst.object+json",
  );
});

test("an unreachable API is an error, not a throw", async () => {
  globalThis.fetch = (() => Promise.reject(new Error("ECONNREFUSED"))) as typeof fetch;

  const { data, error, status } = await client().from("items").select();

  expect(data).toBeNull();
  expect(status).toBe(0);
  expect(error?.message).toContain("http://api.test");
});
