import { expect, test } from "vitest";
import { DomainError } from "#domain";
import { TOOLS } from "../../../src/delivery/mcp/catalog.ts";
import { open, rpc, server, testSession, toolText } from "./mcp-harness.ts";
import { createMcpServer } from "../../../src/delivery/mcp/server.ts";

test("initialize names the server and does not open the project", async () => {
  const mcp = createMcpServer("0.5.0", async () => {
    throw new Error("initialize must not open a project");
  });
  const response = await rpc(mcp, "initialize", {
    protocolVersion: "2025-03-26",
    capabilities: {},
    clientInfo: { name: "test", version: "0" },
  });
  expect(response).toMatchObject({
    result: {
      protocolVersion: "2025-03-26",
      serverInfo: { name: "baseplate", version: "0.5.0" },
      capabilities: { tools: {} },
    },
  });
});

test("tools/list is the catalog", async () => {
  const response = await rpc(server(), "tools/list");
  expect(response).toMatchObject({ result: { tools: TOOLS } });
});

test("an unknown method is JSON-RPC -32601", async () => {
  expect(await rpc(server(), "nope")).toMatchObject({
    error: { code: -32601, message: "Unknown method 'nope'." },
  });
});

test("invalid JSON is JSON-RPC -32700", async () => {
  expect(await server().accept("{")).toMatchObject({
    error: { code: -32700 },
  });
});

test("initialized without an id is a notification", async () => {
  expect(
    await server().accept(
      JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }),
    ),
  ).toBeNull();
});

test("a missing project becomes a tool error, not a crash", async () => {
  const mcp = createMcpServer("0.0.0-test", async () => {
    throw new DomainError("cli.missing_env_file", "No Baseplate project here.");
  });
  const { text, isError } = toolText(
    await rpc(mcp, "tools/call", { name: "tables", arguments: {} }),
  );
  expect(isError).toBe(true);
  expect(text).toContain("cli.missing_env_file");
});

test("tools/call without a name is invalid params", async () => {
  expect(await rpc(server(), "tools/call", {})).toMatchObject({
    error: { code: -32602 },
  });
});

test("open is used only for tools/call", async () => {
  let opened = 0;
  const mcp = createMcpServer("0.0.0-test", (run) => {
    opened += 1;
    return run(testSession());
  });
  await rpc(mcp, "initialize", { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "t", version: "0" } });
  await rpc(mcp, "tools/list", undefined, 2);
  expect(opened).toBe(0);
  await rpc(mcp, "tools/call", { name: "tables", arguments: {} }, 3);
  expect(opened).toBe(1);
});

test("open is released after a tool returns", async () => {
  const session = testSession();
  let closed = 0;
  const mcp = createMcpServer("0.0.0-test", async (run) => {
    try {
      return await open(session)(run);
    } finally {
      closed += 1;
    }
  });
  await rpc(mcp, "tools/call", { name: "tables", arguments: {} });
  expect(closed).toBe(1);
});
