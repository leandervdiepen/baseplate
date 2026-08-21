import { InspectSchema } from "#application";
import { MemorySchemaAdmin } from "#infrastructure";
import { expect, test } from "vitest";

/** Remembers how much history it was asked for, which is the only rule here. */
class AskedSchemaAdmin extends MemorySchemaAdmin {
  asked: number | undefined;

  override async history(limit: number) {
    this.asked = limit;
    return super.history(limit);
  }
}

test("the tables are the ones the database has", async () => {
  const admin = new MemorySchemaAdmin([{ name: "notes", ownerColumn: "owner_id", columns: [] }]);

  expect((await new InspectSchema({ admin }).tables()).map((table) => table.name)).toEqual([
    "notes",
  ]);
});

test("history nobody sized is the last twenty changes", async () => {
  const admin = new AskedSchemaAdmin();

  await new InspectSchema({ admin }).history();

  expect(admin.asked).toBe(20);
});

test("a screen that wants more history asks for it", async () => {
  const admin = new AskedSchemaAdmin();

  await new InspectSchema({ admin }).history(50);

  expect(admin.asked).toBe(50);
});
