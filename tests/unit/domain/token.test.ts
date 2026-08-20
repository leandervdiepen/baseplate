import { createTokenClaims, parseCallerId } from "#domain";
import { expect, test } from "vitest";

const subject = parseCallerId("11111111-1111-4111-8111-111111111111");

test("claims carry the caller, the role, and how long they last", () => {
  expect(createTokenClaims(subject, "app_user", 3600)).toEqual({
    subject,
    role: "app_user",
    lifetimeSeconds: 3600,
  });
});

test("rejects a role that is not a lowercase identifier", () => {
  expect(() => createTokenClaims(subject, "App User", 3600)).toThrowError(
    expect.objectContaining({ code: "token.invalid_role" }),
  );
});

test.for([[0], [-1], [1.5], [Number.NaN], [Number.POSITIVE_INFINITY]])(
  "rejects a lifetime of %s",
  ([lifetime]) => {
    expect(() => createTokenClaims(subject, "app_user", lifetime as number)).toThrowError(
      expect.objectContaining({ code: "token.invalid_lifetime" }),
    );
  },
);
