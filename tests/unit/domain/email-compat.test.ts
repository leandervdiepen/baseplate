import { createEmail } from "#domain";
import { expect, test } from "vitest";
import { normalizeEmail } from "../../../stack/auth/src/email.ts";

/**
 * An address reaches the users table through two doors: the operator creating a
 * user from the studio, and a person signing themselves up against the auth
 * service. Those are separate programs holding separate copies of the rule, so
 * one list of addresses goes through both and they have to answer the same.
 */

/** The address as written, and the one spelling both doors must settle on. */
const ADDRESSES: readonly (readonly [string, string | undefined])[] = [
  ["ada@example.com", "ada@example.com"],
  ["  Ada@Example.COM ", "ada@example.com"],
  ["ADA.LOVELACE@EXAMPLE.CO.UK", "ada.lovelace@example.co.uk"],
  ["ada+notes@example.com", "ada+notes@example.com"],
  ["ada_1@sub.example.io", "ada_1@sub.example.io"],
  ["a@b.c", "a@b.c"],
  ["", undefined],
  ["ada", undefined],
  ["ada@", undefined],
  ["@example.com", undefined],
  ["ada@example", undefined],
  ["ada lovelace@example.com", undefined],
  ["ada@@example.com", undefined],
  // An empty label in the domain. These are the ones the auth service used to
  // take and the operator did not, so the same person got a different answer
  // depending on which door they came through.
  ["ada@.example.com", undefined],
  ["ada@example..com", undefined],
  ["ada@example.com.", undefined],
  ["ada@.com", undefined],
];

/** The domain throws where the auth service returns nothing. Same verdict. */
function operatorAnswer(raw: string): string | undefined {
  try {
    return createEmail(raw);
  } catch (error) {
    expect(error).toMatchObject({ code: "users.invalid_email" });
    return undefined;
  }
}

test.for(ADDRESSES)("both doors answer the same for '%s'", ([raw, normalized]) => {
  expect(operatorAnswer(raw)).toBe(normalized);
  expect(normalizeEmail(raw)).toBe(normalized);
});

test("both doors stop at the same length", () => {
  const atLimit = `${"a".repeat(242)}@example.com`;
  const overLimit = `${"a".repeat(243)}@example.com`;
  expect(atLimit).toHaveLength(254);

  expect(operatorAnswer(atLimit)).toBe(atLimit);
  expect(normalizeEmail(atLimit)).toBe(atLimit);
  expect(operatorAnswer(overLimit)).toBeUndefined();
  expect(normalizeEmail(overLimit)).toBeUndefined();
});

test("the list holds both answers, so agreeing on it means something", () => {
  const accepted = ADDRESSES.filter(([, normalized]) => normalized !== undefined);
  expect(accepted.length).toBeGreaterThan(1);
  expect(accepted.length).toBeLessThan(ADDRESSES.length - 1);
});
