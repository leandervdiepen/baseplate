import { ChangeSchema } from "#application";
import { createSchemaChange, createStack, type Stack } from "#domain";
import {
  MemoryMigrationWriter,
  MemorySchemaStore,
  MemoryStackRuntime,
  MemoryStackStateStore,
} from "#infrastructure";
import { expect, test } from "vitest";

function baseStack(): Stack {
  return createStack({
    name: "baseplate",
    hostname: "localhost",
    callerRole: "app_user",
    database: { name: "app", tables: [{ name: "items", ownerColumn: "owner_id" }] },
    accessPolicies: [{ table: "items", ownerColumn: "owner_id" }],
  });
}

function provisioned(): MemoryStackStateStore {
  const store = new MemoryStackStateStore();
  store.record = {
    server: { id: "local", ipv4: "127.0.0.1", status: "running" },
    baseUrl: "http://127.0.0.1:8080",
  };
  return store;
}

const addNotes = createSchemaChange({
  kind: "create-table",
  table: "notes",
  columns: [{ name: "title", type: "text" }],
});

test("a schema change writes a migration, updates the declaration, and applies it", async () => {
  const schema = new MemorySchemaStore(baseStack());
  const migrations = new MemoryMigrationWriter();
  const runtime = new MemoryStackRuntime();

  const result = await new ChangeSchema({
    schema,
    migrations,
    runtime,
    store: provisioned(),
  }).execute(addNotes);

  expect(result.applied).toBe(true);
  expect(migrations.written).toEqual([result.migration]);
  expect(schema.stack.database.tables.map((table) => table.name)).toContain("notes");
  expect(runtime.migrateCalls).toBe(1);
});

test("a schema change on a stack that is not running is written but not applied", async () => {
  const schema = new MemorySchemaStore(baseStack());
  const runtime = new MemoryStackRuntime();

  const result = await new ChangeSchema({
    schema,
    migrations: new MemoryMigrationWriter(),
    runtime,
    store: new MemoryStackStateStore(),
  }).execute(addNotes);

  expect(result.applied).toBe(false);
  expect(runtime.migrateCalls).toBe(0);
  expect(schema.stack.database.tables.map((table) => table.name)).toContain("notes");
});

test("a failed apply leaves neither the migration nor the declaration behind", async () => {
  const schema = new MemorySchemaStore(baseStack());
  const migrations = new MemoryMigrationWriter();
  const runtime = new MemoryStackRuntime();
  runtime.migrateError = new Error("syntax error at or near");

  await expect(
    new ChangeSchema({ schema, migrations, runtime, store: provisioned() }).execute(
      addNotes,
    ),
  ).rejects.toThrow(/syntax error/);

  expect(migrations.written).toEqual([]);
  expect(schema.stack.database.tables.map((table) => table.name)).toEqual(["items"]);
});

test("a rejected change never reaches the migration writer", async () => {
  const migrations = new MemoryMigrationWriter();

  await expect(
    new ChangeSchema({
      schema: new MemorySchemaStore(baseStack()),
      migrations,
      runtime: new MemoryStackRuntime(),
      store: provisioned(),
    }).execute(createSchemaChange({ kind: "drop-table", table: "ghost" })),
  ).rejects.toMatchObject({ code: "schema.unknown_table" });

  expect(migrations.written).toEqual([]);
});
