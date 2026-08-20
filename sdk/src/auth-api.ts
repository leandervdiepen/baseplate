import { AuthError, type AuthUser } from "./auth-types.ts";

/**
 * One thin wrapper per auth endpoint. Nothing here throws and nothing here
 * touches session state, which keeps auth.ts about the state machine.
 */
export type ApiResult<T> = { data: T | null; error: AuthError | null };

/** The wire session. `token` is absent when signup is waiting on confirmation. */
export type SessionPayload = {
  token?: string;
  refreshToken?: string;
  expiresIn?: number;
  user: AuthUser;
};

export type Credentials = { email: string; password: string };

export function signup(url: string, input: Credentials): Promise<ApiResult<SessionPayload>> {
  return send(url, "/auth/signup", { method: "POST", body: json(input) });
}

export function login(url: string, input: Credentials): Promise<ApiResult<SessionPayload>> {
  return send(url, "/auth/login", { method: "POST", body: json(input) });
}

export function refresh(url: string, refreshToken: string): Promise<ApiResult<SessionPayload>> {
  return send(url, "/auth/refresh", { method: "POST", body: json({ refreshToken }) });
}

export function logout(url: string, refreshToken: string): Promise<ApiResult<{ ok?: boolean }>> {
  return send(url, "/auth/logout", { method: "POST", body: json({ refreshToken }) });
}

export function me(url: string, token: string): Promise<ApiResult<{ user?: AuthUser }>> {
  return send(url, "/auth/me", { headers: { authorization: `Bearer ${token}` } });
}

export function recover(url: string, email: string): Promise<ApiResult<{ ok?: boolean }>> {
  return send(url, "/auth/recover", { method: "POST", body: json({ email }) });
}

export function recoverConfirm(
  url: string,
  input: { token: string; password: string },
): Promise<ApiResult<SessionPayload>> {
  return send(url, "/auth/recover/confirm", { method: "POST", body: json(input) });
}

export function changePassword(
  url: string,
  token: string,
  input: { currentPassword: string; newPassword: string },
): Promise<ApiResult<SessionPayload>> {
  return send(url, "/auth/password", {
    method: "POST",
    headers: { authorization: `Bearer ${token}` },
    body: json(input),
  });
}

function json(body: unknown): string {
  return JSON.stringify(body);
}

async function send<T>(url: string, path: string, init: RequestInit): Promise<ApiResult<T>> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  let response: Response;
  try {
    response = await fetch(`${url}${path}`, { ...init, headers });
  } catch {
    return { data: null, error: new AuthError(`Could not reach ${url}.`, 0, "network_error") };
  }
  const payload = await readJson(response);
  if (!response.ok) {
    return { data: null, error: errorFrom(payload, response) };
  }
  return { data: payload as T, error: null };
}

function errorFrom(payload: Record<string, unknown>, response: Response): AuthError {
  const message =
    typeof payload.message === "string" && payload.message
      ? payload.message
      : response.statusText || `Request failed with ${response.status}.`;
  const code = typeof payload.code === "string" && payload.code ? payload.code : "auth_error";
  return new AuthError(message, response.status, code);
}

/** A body that is empty or not JSON is not an error by itself. */
async function readJson(response: Response): Promise<Record<string, unknown>> {
  try {
    const parsed = (await response.json()) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}
