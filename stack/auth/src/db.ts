import postgres from "postgres";
import type { AuthUser } from "./token.ts";

export type StoredRefreshToken = {
  id: string;
  userId: string;
};

/**
 * Everything the service knows about a user. The session wire shape carries
 * only `{id, email}`, so callers hand `issueSession` a narrowed user rather
 * than a whole row.
 */
export type AuthUserRow = AuthUser & {
  emailConfirmedAt: Date | null;
  createdAt: Date;
  lastSignInAt: Date | null;
};

/**
 * Both lookups return the hash, because changing a password checks the current
 * one and only has an id to go on. Nothing serialises this type directly.
 */
export type AuthRecord = AuthUserRow & { passwordHash: string };

export type OneTimeTokenPurpose = "recovery" | "email_verify";

export type AuthDb = {
  findByEmail(email: string): Promise<AuthRecord | undefined>;
  findById(id: string): Promise<AuthRecord | undefined>;
  insertUser(email: string, passwordHash: string): Promise<AuthUser>;
  touchLastSignIn(id: string): Promise<void>;
  updatePassword(id: string, passwordHash: string): Promise<void>;
  confirmEmail(id: string): Promise<void>;
  storeRefreshToken(userId: string, hash: string, expiresAt: Date): Promise<void>;
  findLiveRefreshToken(hash: string): Promise<StoredRefreshToken | undefined>;
  revokeRefreshToken(id: string): Promise<void>;
  revokeAllForUser(userId: string): Promise<void>;
  pruneRefreshTokens(graceDays: number): Promise<number>;
  insertOneTimeToken(
    userId: string,
    purpose: OneTimeTokenPurpose,
    hash: string,
    expiresAt: Date,
  ): Promise<void>;
  consumeOneTimeToken(
    purpose: OneTimeTokenPurpose,
    hash: string,
  ): Promise<string | undefined>;
  pruneOneTimeTokens(graceDays: number): Promise<number>;
  close(): Promise<void>;
};

type UserColumns = {
  id: string;
  email: string;
  password_hash: string;
  email_confirmed_at: Date | null;
  created_at: Date;
  last_sign_in_at: Date | null;
};

function toRecord(row: UserColumns): AuthRecord {
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash,
    emailConfirmedAt: row.email_confirmed_at,
    createdAt: row.created_at,
    lastSignInAt: row.last_sign_in_at,
  };
}

/**
 * The migrate service owns schema and roles. Auth only reads and writes rows,
 * and on auth.users only the password hash and the timestamps beside it.
 */
export function connectAuthDb(config: { authPassword: string }): AuthDb {
  const sql = postgres({
    host: process.env.POSTGRES_HOST ?? "postgres",
    database: process.env.POSTGRES_DB ?? "app",
    username: "auth_service",
    password: config.authPassword,
    max: 4,
  });
  return {
    async findByEmail(email) {
      const rows = await sql<UserColumns[]>`
        select id, email, password_hash, email_confirmed_at, created_at, last_sign_in_at
        from auth.users where email = ${email}`;
      const row = rows[0];
      return row ? toRecord(row) : undefined;
    },
    async findById(id) {
      const rows = await sql<UserColumns[]>`
        select id, email, password_hash, email_confirmed_at, created_at, last_sign_in_at
        from auth.users where id = ${id}`;
      const row = rows[0];
      return row ? toRecord(row) : undefined;
    },
    async insertUser(email, passwordHash) {
      const rows = await sql<
        { id: string; email: string }[]
      >`insert into auth.users (email, password_hash)
        values (${email}, ${passwordHash})
        returning id, email`;
      const row = rows[0];
      if (!row) {
        throw new Error("insert into auth.users returned no row");
      }
      return row;
    },
    async touchLastSignIn(id) {
      await sql`update auth.users
        set last_sign_in_at = now(), updated_at = now()
        where id = ${id}`;
    },
    async updatePassword(id, passwordHash) {
      await sql`update auth.users
        set password_hash = ${passwordHash}, updated_at = now()
        where id = ${id}`;
    },
    /** Idempotent: the first confirmation wins and later ones are no-ops. */
    async confirmEmail(id) {
      await sql`update auth.users
        set email_confirmed_at = now(), updated_at = now()
        where id = ${id} and email_confirmed_at is null`;
    },
    async storeRefreshToken(userId, hash, expiresAt) {
      await sql`insert into auth.refresh_tokens (user_id, token_hash, expires_at)
        values (${userId}, ${hash}, ${expiresAt})`;
    },
    async findLiveRefreshToken(hash) {
      const rows = await sql<{ id: string; user_id: string }[]>`
        select id, user_id from auth.refresh_tokens
        where token_hash = ${hash} and revoked_at is null and expires_at > now()`;
      const row = rows[0];
      return row ? { id: row.id, userId: row.user_id } : undefined;
    },
    async revokeRefreshToken(id) {
      await sql`update auth.refresh_tokens set revoked_at = now() where id = ${id}`;
    },
    /**
     * A revoked or expired refresh token is a row nobody can use and nobody
     * will read. Without this they accumulate for the life of the project.
     * Kept for a grace period so a support question can still be answered.
     */
    async pruneRefreshTokens(graceDays) {
      const rows = await sql<{ count: string }[]>`
        WITH gone AS (
          DELETE FROM auth.refresh_tokens
          WHERE (revoked_at IS NOT NULL AND revoked_at < now() - make_interval(days => ${graceDays}))
             OR expires_at < now() - make_interval(days => ${graceDays})
          RETURNING 1
        )
        SELECT count(*)::text AS count FROM gone`;
      return Number(rows[0]?.count ?? "0");
    },

    async revokeAllForUser(userId) {
      await sql`update auth.refresh_tokens set revoked_at = now()
        where user_id = ${userId} and revoked_at is null`;
    },
    /**
     * Asking for a second recovery link retires the first one, so an old mail
     * in an inbox cannot be used after a newer one was requested.
     */
    async insertOneTimeToken(userId, purpose, hash, expiresAt) {
      await sql.begin(async (tx) => {
        await tx`delete from auth.one_time_tokens
          where user_id = ${userId} and purpose = ${purpose} and used_at is null`;
        await tx`insert into auth.one_time_tokens (user_id, purpose, token_hash, expires_at)
          values (${userId}, ${purpose}, ${hash}, ${expiresAt})`;
      });
    },
    /**
     * Spending the token and reading it are one statement, so two requests
     * racing on the same link cannot both come back with a user.
     */
    async consumeOneTimeToken(purpose, hash) {
      const rows = await sql<{ user_id: string }[]>`
        update auth.one_time_tokens set used_at = now()
        where token_hash = ${hash} and purpose = ${purpose}
          and used_at is null and expires_at > now()
        returning user_id`;
      return rows[0]?.user_id;
    },
    async pruneOneTimeTokens(graceDays) {
      const rows = await sql<{ count: string }[]>`
        WITH gone AS (
          DELETE FROM auth.one_time_tokens
          WHERE (used_at IS NOT NULL AND used_at < now() - make_interval(days => ${graceDays}))
             OR expires_at < now() - make_interval(days => ${graceDays})
          RETURNING 1
        )
        SELECT count(*)::text AS count FROM gone`;
      return Number(rows[0]?.count ?? "0");
    },
    async close() {
      await sql.end();
    },
  };
}
