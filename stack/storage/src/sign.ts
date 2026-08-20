import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * A URL a browser can put in `<img src>`, which cannot carry an Authorization
 * header. Signed with the stack's JWT secret, bound to one object, and short
 * lived, so it grants exactly one thing for exactly as long as was asked for.
 */
export function signObjectUrl(
  secret: string,
  bucket: string,
  key: string,
  expiresAt: number,
): string {
  return `${expiresAt}.${digest(secret, bucket, key, expiresAt)}`;
}

export type SignatureCheck = { ok: true } | { ok: false; reason: "expired" | "invalid" };

export function checkObjectUrl(
  secret: string,
  bucket: string,
  key: string,
  token: string,
  nowSeconds: number,
): SignatureCheck {
  const dot = token.indexOf(".");
  const expiresAt = Number(token.slice(0, dot));
  const presented = token.slice(dot + 1);
  if (dot === -1 || !Number.isFinite(expiresAt) || presented.length === 0) {
    return { ok: false, reason: "invalid" };
  }
  const expected = digest(secret, bucket, key, expiresAt);
  const a = Buffer.from(presented);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, reason: "invalid" };
  }
  // Checked after the signature, so an expired link and a forged one take the
  // same work to answer.
  if (expiresAt <= nowSeconds) {
    return { ok: false, reason: "expired" };
  }
  return { ok: true };
}

function digest(secret: string, bucket: string, key: string, expiresAt: number): string {
  return createHmac("sha256", secret)
    .update(`${bucket}\n${key}\n${expiresAt}`)
    .digest("base64url");
}
