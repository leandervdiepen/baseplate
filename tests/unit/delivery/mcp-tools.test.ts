import { expect, test } from "vitest";
import { createBucket } from "#domain";
import type { StorageAdmin } from "#application";
import { MemorySchemaAdmin, MemoryUserAdmin } from "#infrastructure";
import { TOOLS } from "../../../src/delivery/mcp/catalog.ts";
import { STACK_COMMANDS } from "../../../src/delivery/cli/usage.ts";
import { rpc, server, SUB, testSession, toolText } from "./mcp-harness.ts";

test("tables is empty until a table is added", async () => {
  const mcp = server();
  expect(JSON.parse(toolText(await rpc(mcp, "tools/call", { name: "tables", arguments: {} })).text)).toEqual(
    [],
  );
  const added = toolText(
    await rpc(mcp, "tools/call", {
      name: "schema",
      arguments: {
        command: "add-table",
        table: "notes",
        columns: [{ name: "title", type: "text" }],
      },
    }, 2),
  );
  expect(added.isError).toBe(false);
  const tables = JSON.parse(
    toolText(await rpc(mcp, "tools/call", { name: "tables", arguments: {} }, 3)).text,
  ) as { name: string }[];
  expect(tables.map((table) => table.name)).toEqual(["notes"]);
});

test("types is TypeScript from the live tables", async () => {
  const admin = new MemorySchemaAdmin([
    {
      name: "notes",
      ownerColumn: "owner_id",
      columns: [
        { name: "id", type: "uuid", nullable: false, primaryKey: true, hasDefault: true },
        { name: "title", type: "text", nullable: false, primaryKey: false, hasDefault: false },
        { name: "owner_id", type: "uuid", nullable: false, primaryKey: false, hasDefault: false },
      ],
    },
  ]);
  const { text, isError } = toolText(
    await rpc(server(testSession({ admin })), "tools/call", { name: "types", arguments: {} }),
  );
  expect(isError).toBe(false);
  expect(text).toContain("export type NotesRow");
  expect(text).toContain("title: string");
  expect(text).not.toContain("owner_id?:");
});

test("drop-table without confirm is refused", async () => {
  const { text, isError } = toolText(
    await rpc(server(), "tools/call", {
      name: "schema",
      arguments: { command: "drop-table", table: "notes" },
    }),
  );
  expect(isError).toBe(true);
  expect(text).toContain("mcp.confirm_required");
});

test("mint-token signs the caller id", async () => {
  const { text, isError } = toolText(
    await rpc(server(), "tools/call", { name: "mint-token", arguments: { sub: SUB } }),
  );
  expect(isError).toBe(false);
  expect(text).toBe(`memory.${SUB}.app_user.3600`);
});

test("users create needs a password because stdio cannot prompt", async () => {
  const { text, isError } = toolText(
    await rpc(server(), "tools/call", {
      name: "users",
      arguments: { command: "create", email: "a@example.test" },
    }),
  );
  expect(isError).toBe(true);
  expect(text).toContain("cli.password_required");
});

test("users create returns the account", async () => {
  const users = new MemoryUserAdmin();
  const { text, isError } = toolText(
    await rpc(server(testSession({ users })), "tools/call", {
      name: "users",
      arguments: { command: "create", email: "a@example.test", password: "a-good-password" },
    }),
  );
  expect(isError).toBe(false);
  expect(JSON.parse(text).email).toBe("a@example.test");
  expect(users.rows).toHaveLength(1);
});

test("rm-bucket without confirm is refused", async () => {
  const storage = recordingStorage();
  const { isError, text } = toolText(
    await rpc(server(testSession({ storage })), "tools/call", {
      name: "storage",
      arguments: { command: "rm-bucket", name: "avatars" },
    }),
  );
  expect(isError).toBe(true);
  expect(text).toContain("mcp.confirm_required");
  expect(storage.dropped).toEqual([]);
});

test("an unknown tool is a tool error", async () => {
  const { isError, text } = toolText(
    await rpc(server(), "tools/call", { name: "drop-database", arguments: {} }),
  );
  expect(isError).toBe(true);
  expect(text).toContain("mcp.unknown_tool");
});

function recordingStorage(): StorageAdmin & { dropped: string[] } {
  const dropped: string[] = [];
  return {
    dropped,
    listBuckets: async () => [createBucket("avatars")],
    createBucket: async () => {},
    setVisibility: async () => {},
    dropBucket: async (name) => {
      dropped.push(name);
      return 0;
    },
    listObjects: async () => [],
    usage: async () => [],
    close: async () => {},
  };
}

/**
 * An agent host is started inside a project that already exists, so init is
 * the one command it has no use for. Everything that acts on a running project
 * has to be here, or the README's claim about the two surfaces is false.
 */
test("the MCP catalogue is exactly the commands that act on a running project", () => {
  expect([...TOOLS].map((tool) => tool.name).sort()).toEqual([...STACK_COMMANDS].sort());
});
