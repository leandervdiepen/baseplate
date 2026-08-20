import { createTokenClaims, parseCallerId } from "#domain";
import { JwtTokenSigner } from "#infrastructure";
import { decodeJwt } from "jose";
import { expect, test } from "vitest";

const secret = "dev-jwt-secret-must-be-at-least-32-chars";
const subject = parseCallerId("11111111-1111-4111-8111-111111111111");

test("signs an HS256 JWT with sub and role claims", async () => {
  const token = await new JwtTokenSigner(secret).sign(
    createTokenClaims(subject, "app_user", 3600),
  );
  const payload = decodeJwt(token);
  expect(payload.sub).toBe(subject);
  expect(payload.role).toBe("app_user");
});

/**
 * A minted token used to carry no `exp` at all, so anything signed by the
 * operator was a bearer that never stopped working.
 */
test("the token says when it was issued and when it stops working", async () => {
  const token = await new JwtTokenSigner(secret).sign(
    createTokenClaims(subject, "app_user", 43_200),
  );
  const payload = decodeJwt(token);
  expect(payload.iat).toBeTypeOf("number");
  expect(payload.exp).toBeTypeOf("number");
  expect((payload.exp ?? 0) - (payload.iat ?? 0)).toBe(43_200);
});

test("rejects a secret shorter than 32 characters", () => {
  expect(() => new JwtTokenSigner("short")).toThrowError(/32 characters/);
});
