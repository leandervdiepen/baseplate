import { createHash, randomBytes } from "node:crypto";
import postgres from "postgres";
import type {
  AdminUser,
  ListUsersQuery,
  ListUsersResult,
  UserAdmin,
} from "#application";
import { createEmail } from "#domain";
import { InfraError } from "#shared";
import { assertPassword, hashPassword } from "../crypto/index.ts";
import type { PostgresAdminConfig } from "./schema-admin.ts";

/** Long enough to walk to a laptop, short enough that a stray link goes stale. */
const RECOVERY_TTL_HOURS = 1;

type UserRow = {
  id: string;
  email: string;
  created_at: Date;
  last_sign_in_at: Date | null;
  email_confirmed_at: Date | null;
};

/**
 * Users live in the operator's database, so the operator tool reads and writes
 * them straight over the loopback port, the same way it does buckets and
 * tables. The auth service is the app's door; this is the operator's.
 */
export class PostgresUserAdmin implements UserAdmin {
  private readonly sql: postgres.Sql;

  constructor(config: PostgresAdminConfig) {
    this.sql = postgres({
      host: config.host,
      port: config.port,
      database: config.database,
      username: "postgres",
      password: config.password,
      max: 1,
      idle_timeout: 5,
      connect_timeout: 10,
      onnotice: () => undefined,
    });
  }

  async listUsers(query: ListUsersQuery): Promise<ListUsersResult> {
    const search = query.search?.trim() ?? "";
    const rows = await this.sql<(UserRow & { total: string })[]>`
      SELECT id, email, created_at, last_sign_in_at, email_confirmed_at,
             (count(*) OVER ())::text AS total
      FROM auth.users
      ${search ? this.sql`WHERE email ILIKE ${`%${search}%`}` : this.sql``}
      ORDER BY created_at DESC
      LIMIT ${query.limit} OFFSET ${query.offset}`;
    return {
      users: rows.map(toAdminUser),
      total: Number(rows[0]?.total ?? "0"),
    };
  }

  async createUser(email: string, password: string, confirmed: boolean): Promise<AdminUser> {
    const address = createEmail(email);
    assertPassword(password);
    const hash = await hashPassword(password);
    try {
      const rows = await this.sql<UserRow[]>`
        INSERT INTO auth.users (email, password_hash, email_confirmed_at)
        VALUES (
          ${address}, ${hash},
          CASE WHEN ${confirmed} THEN now() ELSE NULL END
        )
        RETURNING id, email, created_at, last_sign_in_at, email_confirmed_at`;
      const row = rows[0];
      if (!row) {
        throw new InfraError("users.not_created", "The insert returned no row.");
      }
      return toAdminUser(row);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new InfraError(
          "users.email_taken",
          `There is already a user with the address '${address}'.`,
        );
      }
      throw error;
    }
  }

  /**
   * Their rows stay put. An app's tables own rows by caller id, and deleting
   * the person who made them is not a reason to delete their work; the tokens
   * and sessions go with them by cascade.
   */
  async deleteUser(id: string): Promise<boolean> {
    const rows = await this.sql<{ id: string }[]>`
      DELETE FROM auth.users WHERE id = ${id} RETURNING id`;
    return rows.length > 0;
  }

  async setPassword(id: string, password: string): Promise<void> {
    assertPassword(password);
    const hash = await hashPassword(password);
    await this.sql.begin(async (tx) => {
      const rows = await tx<{ id: string }[]>`
        UPDATE auth.users SET password_hash = ${hash}, updated_at = now()
        WHERE id = ${id} RETURNING id`;
      if (rows.length === 0) {
        throw new InfraError("users.not_found", "There is no user with that id.");
      }
      // A password that changes without ending the old sessions has not really
      // changed: whoever knew the last one is still signed in.
      await tx`UPDATE auth.refresh_tokens SET revoked_at = now()
        WHERE user_id = ${id} AND revoked_at IS NULL`;
    });
  }

  async revokeSessions(id: string): Promise<number> {
    const rows = await this.sql<{ id: string }[]>`
      UPDATE auth.refresh_tokens SET revoked_at = now()
      WHERE user_id = ${id} AND revoked_at IS NULL
      RETURNING id`;
    return rows.length;
  }

  async createRecoveryLink(
    id: string,
    siteUrl: string,
  ): Promise<{ link: string; expiresAt: string }> {
    const token = randomBytes(32).toString("base64url");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const expiresAt = (await this.sql.begin(async (tx) => {
      const users = await tx<{ id: string }[]>`
        SELECT id FROM auth.users WHERE id = ${id}`;
      if (users.length === 0) {
        throw new InfraError("users.not_found", "There is no user with that id.");
      }
      // One live link per person. Handing out a second should retire the first.
      await tx`DELETE FROM auth.one_time_tokens
        WHERE user_id = ${id} AND purpose = 'recovery' AND used_at IS NULL`;
      const rows = await tx<{ expires_at: Date }[]>`
        INSERT INTO auth.one_time_tokens (user_id, purpose, token_hash, expires_at)
        VALUES (
          ${id}, 'recovery', ${tokenHash},
          now() + make_interval(hours => ${RECOVERY_TTL_HOURS})
        )
        RETURNING expires_at`;
      const row = rows[0];
      if (!row) {
        throw new InfraError("users.not_created", "The insert returned no row.");
      }
      return row.expires_at;
    })) as Date;
    return {
      link: `${siteUrl.replace(/\/+$/, "")}/reset-password?token=${token}`,
      expiresAt: expiresAt.toISOString(),
    };
  }

  async close(): Promise<void> {
    await this.sql.end();
  }
}

function toAdminUser(row: UserRow): AdminUser {
  return {
    id: row.id,
    email: row.email,
    createdAt: row.created_at.toISOString(),
    ...(row.last_sign_in_at ? { lastSignInAt: row.last_sign_in_at.toISOString() } : {}),
    ...(row.email_confirmed_at
      ? { emailConfirmedAt: row.email_confirmed_at.toISOString() }
      : {}),
  };
}

function isUniqueViolation(error: unknown): boolean {
  return (error as { code?: string } | null)?.code === "23505";
}
