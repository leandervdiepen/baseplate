import { expect, test } from "vitest";
import { coerce, editableColumns, type ColumnShape } from "../../../src/delivery/dashboard/lib/row-values.ts";

const columns: ColumnShape[] = [
  { name: "id", type: "uuid", primaryKey: true, owner: false },
  { name: "owner_id", type: "uuid", primaryKey: false, owner: true },
  { name: "title", type: "text", primaryKey: false, owner: false },
  { name: "done", type: "boolean", primaryKey: false, owner: false },
];

test("the form never offers columns the database fills in", () => {
  expect(editableColumns(columns).map((column) => column.name)).toEqual(["title", "done"]);
});

test("a value is sent as the type its column holds", () => {
  expect(coerce("true", "boolean")).toBe(true);
  expect(coerce("no", "boolean")).toBe(false);
  expect(coerce("42", "integer")).toBe(42);
  expect(coerce("1.5", "numeric")).toBe(1.5);
  expect(coerce('{"a":1}', "jsonb")).toEqual({ a: 1 });
  expect(coerce("hello", "text")).toBe("hello");
});

test("a value that will not parse is sent as written, so the database explains why", () => {
  expect(coerce("twelve", "integer")).toBe("twelve");
  expect(coerce("{not json", "jsonb")).toBe("{not json");
});
