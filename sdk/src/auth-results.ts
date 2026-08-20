import type { SessionPayload } from "./auth-api.ts";
import { AuthError, type AuthResult, type AuthSession } from "./auth-types.ts";

/** The wire session as we keep it, or `null` when the server sent no token. */
export function sessionFrom(payload: SessionPayload): AuthSession | null {
  if (typeof payload.token !== "string") {
    return null;
  }
  return {
    token: payload.token,
    refreshToken: payload.refreshToken ?? "",
    expiresIn: payload.expiresIn ?? 0,
    expiresAt: expiryOf(payload.expiresIn),
    user: payload.user,
  };
}

export function ok(session: AuthSession): AuthResult {
  return { data: { user: session.user, session }, error: null };
}

export function failed(error: AuthError | null): AuthResult {
  return {
    data: { user: null, session: null },
    error: error ?? new AuthError("The server sent nothing back.", 0, "network_error"),
  };
}

/** No session and no token to get one with: the caller has to sign in. */
export function signedOut(): AuthResult {
  return {
    data: { user: null, session: null },
    error: new AuthError("Sign in first.", 401, "session_missing"),
  };
}

/**
 * A server that does not report a lifetime gets the benefit of the doubt.
 * Guessing "already expired" would refresh on every single request.
 */
function expiryOf(expiresIn: number | undefined): number {
  return typeof expiresIn === "number" && Number.isFinite(expiresIn)
    ? Date.now() + expiresIn * 1000
    : Number.POSITIVE_INFINITY;
}
