import { expect, test } from "vitest";
import { mergeSchema, parseReferences } from "../../../src/delivery/operator-http/schema.ts";

const spec = {
  definitions: {
    items: {
      properties: {
        id: {
          type: "string",
          format: "uuid",
          description: "Note:\nThis is a Primary Key.<pk/>",
        },
        owner_id: { type: "string", format: "uuid" },
        body: { type: "string" },
      },
    },
  },
};

test("mergeSchema marks pk and owner from OpenAPI", () => {
  const snapshot = mergeSchema([{ name: "items", ownerColumn: "owner_id" }], spec);
  expect(snapshot.live).toBe(true);
  const names = snapshot.tables[0]?.columns.map((column) => column.name);
  expect(names).toEqual(["id", "owner_id", "body"]);
  expect(snapshot.tables[0]?.columns.find((column) => column.name === "id")?.primaryKey).toBe(true);
  expect(snapshot.tables[0]?.columns.find((column) => column.name === "owner_id")?.owner).toBe(true);
});

test("mergeSchema falls back to declared owner when API is down", () => {
  const snapshot = mergeSchema([{ name: "items", ownerColumn: "owner_id" }], null);
  expect(snapshot.live).toBe(false);
  expect(snapshot.tables[0]?.columns).toEqual([
    { name: "owner_id", type: "uuid", primaryKey: false, owner: true },
  ]);
});

test("mergeSchema keeps declared owner when OpenAPI has no table defs", () => {
  const snapshot = mergeSchema([{ name: "items", ownerColumn: "owner_id" }], {
    swagger: "2.0",
    paths: { "/": {} },
  });
  expect(snapshot.live).toBe(true);
  expect(snapshot.tables[0]?.columns).toEqual([
    { name: "owner_id", type: "uuid", primaryKey: false, owner: true },
  ]);
});

test("parseReferences reads PostgREST fk markup", () => {
  expect(parseReferences("<fk table='profiles' column='id'/>")).toEqual({
    table: "profiles",
    column: "id",
  });
});
