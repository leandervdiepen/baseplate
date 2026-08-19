import { expect, test } from "vitest";
import { renderTypes, tsType } from "../../../src/delivery/cli/types-command.ts";

const notes = [
  {
    name: "notes",
    ownerColumn: "owner_id",
    columns: [
      { name: "id", type: "uuid", nullable: false, primaryKey: true },
      { name: "owner_id", type: "uuid", nullable: false, primaryKey: false },
      { name: "title", type: "text", nullable: false, primaryKey: false },
      { name: "pinned", type: "boolean", nullable: true, primaryKey: false },
      { name: "rank", type: "integer", nullable: false, primaryKey: false },
    ],
  },
];

test("a row type describes every column the database has", () => {
  const source = renderTypes(notes);

  expect(source).toContain("id: string;");
  expect(source).toContain("title: string;");
  expect(source).toContain("pinned: boolean | null;");
  expect(source).toContain("rank: number;");
});

test("insert leaves out the columns the database fills in", () => {
  const insert = renderTypes(notes).split("NotesInsert = {")[1]?.split("};")[0] ?? "";

  expect(insert).not.toContain("id:");
  expect(insert).not.toContain("owner_id");
  expect(insert).toContain("title: string;");
  expect(insert).toContain("pinned?: boolean | null;");
});

test("update makes every column optional", () => {
  const update = renderTypes(notes).split("NotesUpdate = {")[1]?.split("};")[0] ?? "";

  expect(update).toContain("title?: string;");
  expect(update).toContain("pinned?: boolean | null;");
});

test("a database with no tables still produces something that compiles", () => {
  expect(renderTypes([])).toContain("export type Database = Record<string, never>;");
});

test("postgres types become the TypeScript ones an app expects", () => {
  expect(tsType("boolean")).toBe("boolean");
  expect(tsType("integer")).toBe("number");
  expect(tsType("numeric")).toBe("number");
  expect(tsType("jsonb")).toBe("Json");
  expect(tsType("timestamp with time zone")).toBe("string");
  expect(tsType("uuid")).toBe("string");
});
