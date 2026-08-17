import { jwtVerify, SignJWT } from "jose";

export type AuthUser = {
  id: string;
  email: string;
};

export function tokenSecret(secret: string): Uint8Array {
  if (secret.length < 32) {
    throw new Error("JWT secret must be at least 32 characters.");
  }
  return new TextEncoder().encode(secret);
}

export async function signUserToken(
  secret: Uint8Array,
  user: AuthUser,
  role: string,
): Promise<string> {
  return new SignJWT({ role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .sign(secret);
}

export async function readUserId(secret: Uint8Array, token: string): Promise<string | undefined> {
  try {
    const { payload } = await jwtVerify(token, secret, { algorithms: ["HS256"] });
    return typeof payload.sub === "string" ? payload.sub : undefined;
  } catch {
    return undefined;
  }
}
