import { createTokenClaims, parseCallerId } from "#domain";
import { JwtTokenSigner } from "#infrastructure";
import { decodeJwt } from "jose";
import { expect, test } from "vitest";

const secret = "dev-jwt-secret-must-be-at-least-32-chars";
const subject = parseCallerId("11111111-1111-4111-8111-111111111111");

test("signs an HS256 JWT with sub and role claims", async () => {
  const token = await new JwtTokenSigner(secret).sign(
    createTokenClaims(subject, "app_user"),
  );
  const payload = decodeJwt(token);
  expect(payload.sub).toBe(subject);
  expect(payload.role).toBe("app_user");
});

test("rejects a secret shorter than 32 characters", () => {
  expect(() => new JwtTokenSigner("short")).toThrowError(/32 characters/);
});
