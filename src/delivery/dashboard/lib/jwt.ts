export type JwtPeek = {
  sub?: string;
  role?: string;
};

export function peekJwt(token: string): JwtPeek {
  const parts = token.split(".");
  if (parts.length < 2) {
    return {};
  }
  try {
    const padded = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
    const payload = JSON.parse(atob(padded + pad)) as {
      sub?: string;
      role?: string;
    };
    return { sub: payload.sub, role: payload.role };
  } catch {
    return {};
  }
}
