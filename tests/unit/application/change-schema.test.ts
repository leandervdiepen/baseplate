import { ChangeSchema } from "#application";
import { createSchemaChange } from "#domain";
import { MemorySchemaAdmin } from "#infrastructure";
import { expect, test } from "vitest";

function adminWithItems(): MemorySchemaAdmin {
  return new MemorySchemaAdmin([
    {
      name: "items",
      ownerColumn: "owner_id",
      columns: [{ name: "id", type: "uuid", nullable: false, primaryKey: true, hasDefault: true }],
    },
  ]);
}

const addNotes = createSchemaChange({
  kind: "create-table",
  table: "notes",
  columns: [{ name: "title", type: "text" }],
});

test("a change is applied to the database and the new tables come back", async () => {
  const admin = adminWithItems();

  const result = await new ChangeSchema({ admin }).execute(addNotes);

  expect(admin.applied).toEqual(["create_table_notes"]);
  expect(result.tables.map((table) => table.name)).toEqual(["items", "notes"]);
});

test("a new table is handed to the database already carrying its owner column", async () => {
  const admin = adminWithItems();

  await new ChangeSchema({ admin }).execute(addNotes);

  expect(admin.tables.find((table) => table.name === "notes")?.ownerColumn).toBe("owner_id");
});

test("a change the database refuses changes nothing", async () => {
  const admin = adminWithItems();
  admin.applyError = new Error("relation already exists");

  await expect(new ChangeSchema({ admin }).execute(addNotes)).rejects.toThrow(
    /already exists/,
  );

  expect(admin.tables.map((table) => table.name)).toEqual(["items"]);
});

test("a change that breaks a rule never reaches the database", async () => {
  const admin = adminWithItems();

  await expect(
    new ChangeSchema({ admin }).execute(
      createSchemaChange({ kind: "drop-table", table: "ghost" }),
    ),
  ).rejects.toMatchObject({ code: "schema.unknown_table" });

  expect(admin.applied).toEqual([]);
});
