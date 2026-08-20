export type AdminUser = {
  readonly id: string;
  readonly email: string;
  readonly createdAt: string;
  readonly lastSignInAt?: string;
  readonly emailConfirmedAt?: string;
};

export type ListUsersQuery = {
  /** Matched against the address, anywhere in it. Empty means everyone. */
  readonly search?: string;
  readonly limit: number;
  readonly offset: number;
};

export type ListUsersResult = {
  readonly users: readonly AdminUser[];
  /** How many match the search, not how many were returned. The pager needs it. */
  readonly total: number;
};

/**
 * Users are the operator's rows in the operator's database, like buckets and
 * tables. An app signs people up through the auth service; this is the other
 * door, for the operator who has to fix an address or let someone back in.
 */
export type UserAdmin = {
  listUsers(query: ListUsersQuery): Promise<ListUsersResult>;
  createUser(email: string, password: string, confirmed: boolean): Promise<AdminUser>;
  /** Their rows stay, owned by an id nobody holds any more. Returns false if there was no such user. */
  deleteUser(id: string): Promise<boolean>;
  /** Sets the hash and revokes every session, so a changed password means something. */
  setPassword(id: string, password: string): Promise<void>;
  revokeSessions(id: string): Promise<number>;
  /** A one-hour link the operator hands over. Replaces any earlier unused one. */
  createRecoveryLink(
    id: string,
    siteUrl: string,
  ): Promise<{ readonly link: string; readonly expiresAt: string }>;
  close(): Promise<void>;
};
