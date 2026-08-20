import { randomUUID } from "node:crypto";
import type {
  AdminUser,
  ListUsersQuery,
  ListUsersResult,
  UserAdmin,
} from "#application";
import { createEmail } from "#domain";
import { InfraError } from "#shared";
import { assertPassword } from "../crypto/index.ts";

/** Enough of the users table to drive the route without a database. */
export class MemoryUserAdmin implements UserAdmin {
  readonly rows: AdminUser[] = [];
  readonly passwords = new Map<string, string>();
  readonly sessions = new Map<string, number>();
  readonly links: string[] = [];

  async listUsers(query: ListUsersQuery): Promise<ListUsersResult> {
    const search = query.search?.trim().toLowerCase() ?? "";
    const matched = this.rows.filter((row) => row.email.includes(search));
    return {
      users: matched.slice(query.offset, query.offset + query.limit),
      total: matched.length,
    };
  }

  async createUser(email: string, password: string, confirmed: boolean): Promise<AdminUser> {
    const address = createEmail(email);
    assertPassword(password);
    if (this.rows.some((row) => row.email === address)) {
      throw new InfraError(
        "users.email_taken",
        `There is already a user with the address '${address}'.`,
      );
    }
    const now = new Date().toISOString();
    const user: AdminUser = {
      id: randomUUID(),
      email: address,
      createdAt: now,
      ...(confirmed ? { emailConfirmedAt: now } : {}),
    };
    // Newest first, the order the real one reads in.
    this.rows.unshift(user);
    this.passwords.set(user.id, password);
    return user;
  }

  async deleteUser(id: string): Promise<boolean> {
    const at = this.rows.findIndex((row) => row.id === id);
    if (at === -1) {
      return false;
    }
    this.rows.splice(at, 1);
    this.passwords.delete(id);
    this.sessions.delete(id);
    return true;
  }

  async setPassword(id: string, password: string): Promise<void> {
    assertPassword(password);
    this.find(id);
    this.passwords.set(id, password);
    this.sessions.set(id, 0);
  }

  async revokeSessions(id: string): Promise<number> {
    this.find(id);
    const live = this.sessions.get(id) ?? 0;
    this.sessions.set(id, 0);
    return live;
  }

  async createRecoveryLink(
    id: string,
    siteUrl: string,
  ): Promise<{ link: string; expiresAt: string }> {
    this.find(id);
    const link = `${siteUrl.replace(/\/+$/, "")}/reset-password?token=token-${this.links.length}`;
    this.links.push(link);
    return { link, expiresAt: new Date(Date.now() + 3_600_000).toISOString() };
  }

  async close(): Promise<void> {}

  private find(id: string): AdminUser {
    const row = this.rows.find((entry) => entry.id === id);
    if (!row) {
      throw new InfraError("users.not_found", "There is no user with that id.");
    }
    return row;
  }
}
