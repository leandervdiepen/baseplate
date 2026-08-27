import { createSchemaChange, createTable } from "#domain";
import {
  protectStatements,
  renderChange,
} from "../../../src/infrastructure/postgres/render-change.ts";
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
      '  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,\n' +
      '  "owner_id" uuid NOT NULL,\n' +
      '  "title" text NOT NULL,\n' +
      '  "pinned" boolean\n' +
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

test("a new table is protected in the same breath as it is created", () => {
  const statements = protectStatements(createTable("notes", "owner_id"));
  const joined = statements.join("\n");

  expect(joined).toContain("ENABLE ROW LEVEL SECURITY");
  expect(joined).toContain('CREATE POLICY "notes_owner"');
  expect(joined).toContain("baseplate.caller_id()");
  expect(joined).toContain('GRANT SELECT, INSERT, UPDATE, DELETE ON public."notes" TO app_user');
  expect(joined).toContain('REVOKE ALL ON public."notes" FROM anon');
});

test("refuses to build SQL from an identifier the domain would not allow", () => {
  expect(() =>
    protectStatements({
      name: "items; drop table x",
      ownerColumn: "owner_id",
      access: "private",
    }),
  ).toThrow(/identifier/);
});

test("a private table shows a caller nothing but their own rows", () => {
  const joined = protectStatements(createTable("notes", "owner_id", "private")).join("\n");

  // Dropped even when it is not replaced, so narrowing a table takes the wider
  // read away instead of leaving it behind.
  expect(joined).toContain('DROP POLICY IF EXISTS "notes_read_all"');
  expect(joined).not.toContain('CREATE POLICY "notes_read_all"');
  expect(joined).not.toContain("TO anon");
});

test("a shared table is read by anyone signed in and still written by the owner", () => {
  const joined = protectStatements(createTable("posts", "owner_id", "shared")).join("\n");

  expect(joined).toContain(
    'CREATE POLICY "posts_read_all" ON public."posts" FOR SELECT' +
      " USING (baseplate.caller_id() IS NOT NULL)",
  );
  expect(joined).toContain(
    'CREATE POLICY "posts_owner" ON public."posts"' +
      ' USING ("owner_id" = baseplate.caller_id())' +
      ' WITH CHECK ("owner_id" = baseplate.caller_id())',
  );
  // Signed in still means a token, so the tokenless role gains nothing.
  expect(joined).not.toContain("TO anon");
});

test("a public table is read without a token, and written by nobody without one", () => {
  const joined = protectStatements(createTable("docs", "owner_id", "public")).join("\n");

  expect(joined).toContain(
    'CREATE POLICY "docs_read_all" ON public."docs" FOR SELECT USING (true)',
  );
  expect(joined).toContain('GRANT SELECT ON public."docs" TO anon');
  expect(joined).not.toContain("INSERT, UPDATE, DELETE ON public.\"docs\" TO anon");
});

test("an insert keeps the caller as the owner, and lets the operator name one", () => {
  const joined = protectStatements(createTable("notes", "owner_id")).join("\n");

  expect(joined).toContain('coalesce(baseplate.caller_id(), NEW."owner_id")');
});
