import { PostgrestSchemaCache, tableNames } from "#infrastructure";
import { expect, test } from "vitest";

/** PostgREST answers an insert into an uncached table with a bare `404 {}`. */

const SPEC = {
  paths: {
    "/": {},
    "/items": {},
    "/notes": {},
    "/rpc/gen_random_uuid": {},
  },
};

test("the tables the API serves are the paths that are not the root or a function", () => {
  expect([...tableNames(SPEC)]).toEqual(["items", "notes"]);
});

test("a spec with nothing in it names no tables", () => {
  expect(tableNames({}).size).toBe(0);
  expect(tableNames(null).size).toBe(0);
});

test("waiting returns as soon as every table is served", async () => {
  const asked: string[] = [];
  const cache = new PostgrestSchemaCache({
    baseUrl: "http://127.0.0.1:1/",
    callerToken: async () => "token",
    fetch: async (url) => {
      asked.push(url);
      return new Response(JSON.stringify(SPEC), { status: 200 });
    },
  });

  await cache.waitFor(["items", "notes"]);

  expect(asked).toEqual(["http://127.0.0.1:1/"]);
});

test("waiting keeps asking while a table is still missing, then gives up", async () => {
  let calls = 0;
  const cache = new PostgrestSchemaCache({
    baseUrl: "http://127.0.0.1:1/",
    callerToken: async () => "token",
    timeoutMs: 30,
    intervalMs: 5,
    fetch: async () => {
      calls += 1;
      return new Response(JSON.stringify(SPEC), { status: 200 });
    },
  });

  await cache.waitFor(["items", "ghost"]);

  expect(calls).toBeGreaterThan(1);
});

test("an API that answers a new table on the second ask is waited for, not given up on", async () => {
  let calls = 0;
  const cache = new PostgrestSchemaCache({
    baseUrl: "http://127.0.0.1:1/",
    callerToken: async () => "token",
    intervalMs: 1,
    fetch: async () => {
      calls += 1;
      const paths: Record<string, unknown> = { "/": {}, "/items": {} };
      if (calls > 1) {
        paths["/notes"] = {};
      }
      return new Response(JSON.stringify({ paths }), { status: 200 });
    },
  });

  await cache.waitFor(["items", "notes"]);

  expect(calls).toBe(2);
});

test("an API that is not there is not waited for: the change already landed", async () => {
  let calls = 0;
  const cache = new PostgrestSchemaCache({
    baseUrl: "http://127.0.0.1:1/",
    callerToken: async () => "token",
    timeoutMs: 60_000,
    fetch: async () => {
      calls += 1;
      throw new Error("connect ECONNREFUSED");
    },
  });

  await cache.waitFor(["items"]);

  expect(calls).toBe(1);
});

test("a change that leaves no tables asks the API nothing", async () => {
  let calls = 0;
  const cache = new PostgrestSchemaCache({
    baseUrl: "http://127.0.0.1:1/",
    callerToken: async () => "token",
    fetch: async () => {
      calls += 1;
      return new Response("{}", { status: 200 });
    },
  });

  await cache.waitFor([]);

  expect(calls).toBe(0);
});
