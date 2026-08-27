import { ReadLogs } from "#application";
import { createServer } from "#domain";
import { MemoryStackRuntime, MemoryStackStateStore } from "#infrastructure";
import { expect, test } from "vitest";

/** Where the containers are is the runtime's answer, not a route's guess. */

function parts(): { runtime: MemoryStackRuntime; store: MemoryStackStateStore } {
  const runtime = new MemoryStackRuntime();
  runtime.logLines = ["caddy | up", "auth  | listening", "auth  | login failed"];
  return { runtime, store: new MemoryStackStateStore() };
}

test("the stack's own lines come back", async () => {
  const { runtime, store } = parts();

  const text = await new ReadLogs({ runtime, store }).execute();

  expect(text.split("\n")).toHaveLength(3);
  expect(text).toContain("auth  | listening");
});

test("only the tail asked for comes back", async () => {
  const { runtime, store } = parts();

  const text = await new ReadLogs({ runtime, store }).execute(1);

  expect(text).toBe("auth  | login failed");
});

test("a remote project's server is handed to the runtime, so it can go there", async () => {
  const { runtime, store } = parts();
  const server = createServer("srv-1", "203.0.113.10", "running");
  await store.save({ server, baseUrl: "https://api.example.com" });
  const seen: (string | undefined)[] = [];
  runtime.logs = async (given) => {
    seen.push(given?.ipv4);
    return "";
  };

  await new ReadLogs({ runtime, store }).execute();

  expect(seen).toEqual(["203.0.113.10"]);
});

test("a project with no server yet asks anyway: a local stack needs none", async () => {
  const { runtime, store } = parts();
  const seen: (string | undefined)[] = [];
  runtime.logs = async (given) => {
    seen.push(given?.ipv4);
    return "";
  };

  await new ReadLogs({ runtime, store }).execute();

  expect(seen).toEqual([undefined]);
});
