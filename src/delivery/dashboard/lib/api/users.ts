/**
 * The people behind the tokens. Operator HTTP reaches the auth schema with its
 * own role on this machine, so these calls answer whether or not anybody is
 * signed in to the studio.
 */
import { get, post, query, send } from "./http.ts";

/** A row of `auth.users`, as operator HTTP describes it. */
export type OperatorUser = {
  id: string;
  email: string;
  createdAt: string;
  /** Null until they sign in for the first time. */
  lastSignInAt: string | null;
  /** Null while the address is still unconfirmed. */
  emailConfirmedAt: string | null;
};

export type UserPage = {
  /** False when the database is not up: the page says so instead of showing nobody. */
  live: boolean;
  /** Every match, not only this page, so the pager knows where it ends. */
  total: number;
  users: OperatorUser[];
};

export const listUsers = ({
  search,
  limit,
  offset,
}: {
  search: string;
  limit: number;
  offset: number;
}): Promise<UserPage> =>
  get<UserPage>(`/api/users?${query({ search, limit: String(limit), offset: String(offset) })}`);

export const createUser = (email: string, password: string): Promise<{ user: OperatorUser }> =>
  post<{ user: OperatorUser }>("/api/users", { email, password });

/** Their sessions and tokens go with them. Rows they own stay where they are. */
export const deleteUser = async (id: string): Promise<void> => {
  await send<{ removed: true }>("DELETE", `/api/users?${query({ id })}`);
};

/** A one-time link that lets them set a new password. It is emailed as well. */
export const recoveryLink = (id: string): Promise<{ link: string; expiresAt: string }> =>
  post<{ link: string; expiresAt: string }>("/api/users/recovery-link", { id });

export const revokeUserSessions = (id: string): Promise<{ revoked: number }> =>
  post<{ revoked: number }>("/api/users/revoke-sessions", { id });
