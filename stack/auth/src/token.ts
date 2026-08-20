import { createHash, randomBytes } from "node:crypto";
import { jwtVerify, SignJWT } from "jose";

export type AuthUser = {
  id: string;
  email: string;
};

export type TokenConfig = {
  secret: Uint8Array;
  role: string;
  accessTtlSeconds: number;
  refreshTtlSeconds: number;
};

export function tokenSecret(secret: string): Uint8Array {
  if (secret.length < 32) {
    throw new Error("JWT secret must be at least 32 characters.");
  }
  return new TextEncoder().encode(secret);
}

/**
 * Short-lived and signed. PostgREST reads `sub` and `role`, and rejects the
 * token once `exp` passes, so a leaked access token stops working on its own.
 */
export async function signAccessToken(
  config: TokenConfig,
  user: AuthUser,
): Promise<string> {
  return new SignJWT({ role: config.role, email: user.email })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${config.accessTtlSeconds}s`)
    .sign(config.secret);
}

export async function readUserId(
  secret: Uint8Array,
  token: string,
): Promise<string | undefined> {
  try {
    const { payload } = await jwtVerify(token, secret, { algorithms: ["HS256"] });
    return typeof payload.sub === "string" ? payload.sub : undefined;
  } catch {
    return undefined;
  }
}

/** Opaque, not a JWT: it is checked against a row that can be revoked. */
export function createRefreshToken(): { value: string; hash: string } {
  const value = createOpaqueToken();
  return { value, hash: hashToken(value) };
}

/** The shape every secret that lives in a row has: 32 random bytes, url-safe. */
export function createOpaqueToken(): string {
  return randomBytes(32).toString("base64url");
}

/**
 * Refresh tokens and emailed one-time tokens are both stored as this hash, so
 * a database dump carries nothing that can be presented.
 */
export function hashToken(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
