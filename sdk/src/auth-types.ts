export type AuthUser = {
  id: string;
  email: string;
  /** `null` until the address is confirmed. Absent on servers that predate confirmation. */
  emailConfirmedAt?: string | null;
};

export type AuthSession = {
  token: string;
  refreshToken: string;
  /** Seconds the access token is good for, from when it was issued. */
  expiresIn: number;
  /** Wall-clock milliseconds. `Infinity` when the server named no lifetime. */
  expiresAt: number;
  user: AuthUser;
};

/**
 * Every auth call returns one of these instead of throwing, so a form can
 * render the message without a try/catch around it.
 */
export class AuthError extends Error {
  /** HTTP status, or `0` when the server could not be reached at all. */
  readonly status: number;
  /** The server's dotted code (`auth.invalid_credentials`) or a local one. */
  readonly code: string;

  constructor(message: string, status: number, code = "auth_error") {
    super(message);
    this.name = "AuthError";
    this.status = status;
    this.code = code;
  }
}

export type AuthChangeEvent =
  | "INITIAL_SESSION"
  | "SIGNED_IN"
  | "TOKEN_REFRESHED"
  | "USER_UPDATED"
  | "SIGNED_OUT";

export type AuthListener = (event: AuthChangeEvent, session: AuthSession | null) => void;

export type AuthResult = {
  data: { user: AuthUser | null; session: AuthSession | null };
  error: AuthError | null;
};

export type UserResult = {
  data: { user: AuthUser | null };
  error: AuthError | null;
};
