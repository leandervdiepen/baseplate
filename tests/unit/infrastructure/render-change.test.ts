import { createSchemaChange } from "#domain";
import { renderChange } from "../../../src/infrastructure/postgres/render-change.ts";
import { expect, test } from "vitest";

test("a created table gets an id and a not-null owner column", () => {
  const sql = renderChange(
    createSchemaChange({
      kind: "create-table",
      table: "notes",
      columns: [
        { name: "title", type: "text" },
        { name: "pinned", type: "boolean", nullable: true },
      ],
    }),
  );

  expect(sql).toBe(
    'CREATE TABLE "notes" (\n' +
      '\t"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,\n' +
      '\t"owner_id" uuid NOT NULL,\n' +
      '\t"title" text NOT NULL,\n' +
      '\t"pinned" boolean\n' +
      ");",
  );
});

test("added columns default to nullable so an existing table can take them", () => {
  const sql = renderChange(
    createSchemaChange({
      kind: "add-column",
      table: "items",
      column: { name: "done", type: "boolean" },
    }),
  );

  expect(sql).toBe('ALTER TABLE "items" ADD COLUMN "done" boolean;');
});

test("renders drop and rename", () => {
  expect(renderChange(createSchemaChange({ kind: "drop-table", table: "notes" }))).toBe(
    'DROP TABLE "notes";',
  );
  expect(
    renderChange(createSchemaChange({ kind: "rename-table", table: "notes", to: "memos" })),
  ).toBe('ALTER TABLE "notes" RENAME TO "memos";');
  expect(
    renderChange(
      createSchemaChange({
        kind: "drop-column",
        table: "items",
        column: { name: "body" },
      }),
    ),
  ).toBe('ALTER TABLE "items" DROP COLUMN "body";');
});
