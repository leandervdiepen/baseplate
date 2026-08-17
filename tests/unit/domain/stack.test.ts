import { createStack, DomainError, parseCallerId, parseHostname } from "#domain";
import { expect, test } from "vitest";

const valid = {
  name: "baseplate",
  hostname: "localhost",
  callerRole: "app_user",
  database: {
    name: "app",
    tables: [{ name: "items", ownerColumn: "owner_id" }],
  },
  accessPolicies: [{ table: "items", ownerColumn: "owner_id" }],
};

test("parses a caller UUID", () => {
  expect(parseCallerId("11111111-1111-4111-8111-111111111111")).toBe(
    "11111111-1111-4111-8111-111111111111",
  );
});

test("rejects a caller id that is not a UUID", () => {
  expect(() => parseCallerId("alice")).toThrow(DomainError);
});

test("accepts localhost and a domain as hostname", () => {
  expect(parseHostname("localhost")).toBe("localhost");
  expect(parseHostname("api.example.com")).toBe("api.example.com");
});

test("rejects a hostname that is neither localhost nor a domain", () => {
  expect(() => parseHostname("not a host")).toThrow(DomainError);
});

test("creates a stack when policies match tables", () => {
  const stack = createStack(valid);
  expect(stack.database.tables).toHaveLength(1);
  expect(stack.accessPolicies[0]?.table).toBe("items");
});

test("rejects a stack with no tables", () => {
  expect(() =>
    createStack({
      ...valid,
      database: { name: "app", tables: [] },
      accessPolicies: [],
    }),
  ).toThrowError(/at least one table/);
});

test("rejects a policy on a missing table", () => {
  expect(() =>
    createStack({
      ...valid,
      accessPolicies: [{ table: "notes", ownerColumn: "owner_id" }],
    }),
  ).toThrowError(/missing table/);
});

test("rejects a policy whose owner column does not match the table", () => {
  expect(() =>
    createStack({
      ...valid,
      accessPolicies: [{ table: "items", ownerColumn: "user_id" }],
    }),
  ).toThrowError(/must match table/);
});
