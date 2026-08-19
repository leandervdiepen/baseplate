import { applySchemaChange, createSchemaChange, createStack, DomainError } from "#domain";
import { expect, test } from "vitest";

function codeOf(act: () => unknown): string {
  try {
    act();
  } catch (error) {
    return error instanceof DomainError ? error.code : "not-a-domain-error";
  }
  return "no-error";
}

const stack = createStack({
  name: "baseplate",
  hostname: "localhost",
  callerRole: "app_user",
  database: { name: "app", tables: [{ name: "items", ownerColumn: "owner_id" }] },
  accessPolicies: [{ table: "items", ownerColumn: "owner_id" }],
});

test("a created table arrives with a row access policy", () => {
  const change = createSchemaChange({
    kind: "create-table",
    table: "notes",
    columns: [{ name: "title", type: "text" }],
  });

  const next = applySchemaChange(stack, change);

  expect(next.database.tables.map((table) => table.name)).toEqual(["items", "notes"]);
  expect(next.accessPolicies).toContainEqual({ table: "notes", ownerColumn: "owner_id" });
});

test("a dropped table loses its policy", () => {
  const withNotes = applySchemaChange(
    stack,
    createSchemaChange({ kind: "create-table", table: "notes" }),
  );

  const next = applySchemaChange(
    withNotes,
    createSchemaChange({ kind: "drop-table", table: "notes" }),
  );

  expect(next.accessPolicies.map((policy) => policy.table)).toEqual(["items"]);
});

test("a renamed table keeps its policy under the new name", () => {
  const next = applySchemaChange(
    stack,
    createSchemaChange({ kind: "rename-table", table: "items", to: "notes" }),
  );

  expect(next.accessPolicies).toEqual([{ table: "notes", ownerColumn: "owner_id" }]);
});

test("rejects dropping the owner column", () => {
  expect(() =>
    applySchemaChange(
      stack,
      createSchemaChange({
        kind: "drop-column",
        table: "items",
        column: { name: "owner_id" },
      }),
    ),
  ).toThrow(/owner column/i);
});

test("rejects dropping the last table", () => {
  expect(() =>
    applySchemaChange(stack, createSchemaChange({ kind: "drop-table", table: "items" })),
  ).toThrow(/at least one table/i);
});

test("rejects a change to a table that is not declared", () => {
  expect(
    codeOf(() =>
      applySchemaChange(stack, createSchemaChange({ kind: "drop-table", table: "ghost" })),
    ),
  ).toBe("schema.unknown_table");
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
