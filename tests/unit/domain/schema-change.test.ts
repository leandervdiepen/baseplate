import { applySchemaChange, createSchemaChange, createTable, DomainError } from "#domain";
import { expect, test } from "vitest";

const items = [createTable("items", "owner_id")];

function codeOf(act: () => unknown): string {
  try {
    act();
  } catch (error) {
    return error instanceof DomainError ? error.code : "not-a-domain-error";
  }
  return "no-error";
}

test("a created table arrives carrying its owner column", () => {
  const next = applySchemaChange(
    items,
    createSchemaChange({
      kind: "create-table",
      table: "notes",
      columns: [{ name: "title", type: "text" }],
    }),
  );

  expect(next).toContainEqual({ name: "notes", ownerColumn: "owner_id" });
});

test("a dropped table leaves the set", () => {
  const withNotes = applySchemaChange(
    items,
    createSchemaChange({ kind: "create-table", table: "notes" }),
  );

  const next = applySchemaChange(
    withNotes,
    createSchemaChange({ kind: "drop-table", table: "notes" }),
  );

  expect(next.map((table) => table.name)).toEqual(["items"]);
});

test("a renamed table keeps its owner column under the new name", () => {
  const next = applySchemaChange(
    items,
    createSchemaChange({ kind: "rename-table", table: "items", to: "notes" }),
  );

  expect(next).toEqual([{ name: "notes", ownerColumn: "owner_id" }]);
});

test("rejects dropping the owner column", () => {
  expect(
    codeOf(() =>
      applySchemaChange(
        items,
        createSchemaChange({
          kind: "drop-column",
          table: "items",
          column: { name: "owner_id" },
        }),
      ),
    ),
  ).toBe("schema.owner_column_required");
});

test("rejects a change to a table that does not exist", () => {
  expect(
    codeOf(() =>
      applySchemaChange(items, createSchemaChange({ kind: "drop-table", table: "ghost" })),
    ),
  ).toBe("schema.unknown_table");
});

test("rejects creating a table that is already there", () => {
  expect(
    codeOf(() =>
      applySchemaChange(items, createSchemaChange({ kind: "create-table", table: "items" })),
    ),
  ).toBe("schema.table_exists");
});

test("rejects a column type the stack cannot create", () => {
  expect(
    codeOf(() =>
      createSchemaChange({
        kind: "add-column",
        table: "items",
        column: { name: "price", type: "money" },
      }),
    ),
  ).toBe("column.unsupported_type");
});

test("rejects an identifier that is not a plain lowercase name", () => {
  expect(
    codeOf(() => createSchemaChange({ kind: "create-table", table: "DROP TABLE items" })),
  ).toBe("schema.invalid_table");
});
