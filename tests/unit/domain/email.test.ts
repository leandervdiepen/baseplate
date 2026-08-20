import { createEmail } from "#domain";
import { expect, test } from "vitest";

test("one spelling per address: trimmed and lowercased", () => {
  expect(createEmail("  Ada@Example.COM ")).toBe("ada@example.com");
});

test("accepts the shapes real addresses take", () => {
  for (const raw of [
    "ada@example.com",
    "ada.lovelace@example.co.uk",
    "ada+notes@example.com",
    "ada_1@sub.example.io",
  ]) {
    expect(createEmail(raw)).toBe(raw);
  }
});

test.for([
  ["", "empty"],
  ["ada", "no domain"],
  ["ada@", "nothing after the @"],
  ["@example.com", "nothing before the @"],
  ["ada@example", "no dot in the domain"],
  ["ada lovelace@example.com", "a space in it"],
  ["ada@@example.com", "two @"],
])("rejects '%s'", ([raw]) => {
  expect(() => createEmail(raw as string)).toThrowError(/not an email address/);
});

test("rejects an address longer than a mail server would take", () => {
  const long = `${"a".repeat(250)}@example.com`;
  expect(() => createEmail(long)).toThrowError(/at most 254/);
});

test("names its own error code so a route can answer with it", () => {
  expect(() => createEmail("nope")).toThrowError(
    expect.objectContaining({ code: "users.invalid_email" }),
  );
});
