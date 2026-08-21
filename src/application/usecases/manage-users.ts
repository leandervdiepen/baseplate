import { DomainError } from "#domain";
import type { AdminUser, ListUsersResult, UserAdmin } from "../ports/user-admin.ts";

export type ManageUsersDeps = {
  users: UserAdmin;
};

export type UserPage = {
  /** Matched against the address, anywhere in it. Empty means everyone. */
  readonly search?: string;
  readonly limit?: number;
  readonly offset?: number;
};

export type RecoveryLink = {
  readonly link: string;
  readonly expiresAt: string;
};

/** One screen of people. */
const PAGE = 50;

/** A stray `?limit=1000000` does not get to ask for the lot. */
const MAX_PAGE = 200;

/**
 * Users are the operator's rows in the operator's database, like buckets and
 * tables. An app signs people up through the auth service; this is the other
 * door, for the operator who has to fix an address or let someone back in.
 */
export class ManageUsers {
  private readonly deps: ManageUsersDeps;

  constructor(deps: ManageUsersDeps) {
    this.deps = deps;
  }

  async list(page: UserPage = {}): Promise<ListUsersResult> {
    return this.deps.users.listUsers({
      ...(page.search ? { search: page.search } : {}),
      limit: pageSize(page.limit),
      offset: startAt(page.offset),
    });
  }

  /**
   * The operator's door, so the account works straight away unless they say
   * otherwise. Someone made by hand has nobody to click a confirmation mail.
   */
  async create(email: string, password: string, confirmed = true): Promise<AdminUser> {
    return this.deps.users.createUser(email, password, confirmed);
  }

  /**
   * Their rows stay, owned by an id nobody holds any more. The adapter answers
   * whether there was anyone to remove; being told there was not is an error,
   * not a quiet success.
   */
  async remove(id: string): Promise<void> {
    if (!(await this.deps.users.deleteUser(id))) {
      throw new DomainError("users.not_found", `There is no user with id ${id}.`);
    }
  }

  /** Sets the hash and revokes every session, so a changed password means something. */
  async setPassword(id: string, password: string): Promise<void> {
    await this.deps.users.setPassword(id, password);
  }

  async revokeSessions(id: string): Promise<number> {
    return this.deps.users.revokeSessions(id);
  }

  /** A one-hour link the operator hands over. Replaces any earlier unused one. */
  async recoveryLink(id: string, siteUrl: string): Promise<RecoveryLink> {
    return this.deps.users.createRecoveryLink(id, siteUrl);
  }
}

function pageSize(raw: number | undefined): number {
  if (raw === undefined || !Number.isInteger(raw) || raw < 1) {
    return PAGE;
  }
  return Math.min(raw, MAX_PAGE);
}

function startAt(raw: number | undefined): number {
  return raw !== undefined && Number.isInteger(raw) && raw > 0 ? raw : 0;
}
