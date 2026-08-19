export type JwtPeek = {
  sub?: string | undefined;
  role?: string | undefined;
};

/**
 * Reads the claims a token carries without verifying it. The signature is the
 * API's business; this only labels what the operator is holding.
 */
export function peekJwt(token: string): JwtPeek {
  const encoded = token.split(".")[1];
  if (!encoded) {
    return {};
  }
  try {
    const padded = encoded.replaceAll("-", "+").replaceAll("_", "/");
    const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
    const payload = JSON.parse(atob(padded + pad)) as JwtPeek;
    return { sub: payload.sub, role: payload.role };
  } catch {
    return {};
  }
}
