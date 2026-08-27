import { ChangeSchema } from "#application";
import { createSchemaChange } from "#domain";
import { MemoryApiSchemaCache, MemorySchemaAdmin } from "#infrastructure";
import { expect, test } from "vitest";

function adminWithItems(): MemorySchemaAdmin {
  return new MemorySchemaAdmin([
    {
      name: "items",
      ownerColumn: "owner_id",
      access: "private" as const,
      columns: [{ name: "id", type: "uuid", nullable: false, primaryKey: true, hasDefault: true }],
    },
  ]);
}

function changeSchema(admin: MemorySchemaAdmin, api = new MemoryApiSchemaCache()): ChangeSchema {
  return new ChangeSchema({ admin, api });
}

const addNotes = createSchemaChange({
  kind: "create-table",
  table: "notes",
  columns: [{ name: "title", type: "text" }],
});

test("a change is applied to the database and the new tables come back", async () => {
  const admin = adminWithItems();

  const result = await changeSchema(admin).execute(addNotes);

  expect(admin.applied).toEqual(["create_table_notes"]);
  expect(result.tables.map((table) => table.name)).toEqual(["items", "notes"]);
});

test("a new table is handed to the database already carrying its owner column", async () => {
  const admin = adminWithItems();

  await changeSchema(admin).execute(addNotes);

  expect(admin.tables.find((table) => table.name === "notes")?.ownerColumn).toBe("owner_id");
});

test("a change is not finished until the API serves the tables it left behind", async () => {
  const admin = adminWithItems();
  const api = new MemoryApiSchemaCache();

  await changeSchema(admin, api).execute(addNotes);

  expect(api.waited).toEqual([["items", "notes"]]);
});

test("a change the database refuses changes nothing", async () => {
  const admin = adminWithItems();
  admin.applyError = new Error("relation already exists");
  const api = new MemoryApiSchemaCache();

  await expect(changeSchema(admin, api).execute(addNotes)).rejects.toThrow(/already exists/);

  expect(admin.tables.map((table) => table.name)).toEqual(["items"]);
  expect(api.waited).toEqual([]);
});

test("a change that breaks a rule never reaches the database", async () => {
  const admin = adminWithItems();

  await expect(
    changeSchema(admin).execute(createSchemaChange({ kind: "drop-table", table: "ghost" })),
  ).rejects.toMatchObject({ code: "schema.unknown_table" });

  expect(admin.applied).toEqual([]);
});
