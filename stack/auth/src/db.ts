import postgres from "postgres";
import type { AuthUser } from "./token.ts";

export type StoredRefreshToken = {
  id: string;
  userId: string;
};

export type AuthDb = {
  findByEmail(email: string): Promise<(AuthUser & { passwordHash: string }) | undefined>;
  findById(id: string): Promise<AuthUser | undefined>;
  insertUser(email: string, passwordHash: string): Promise<AuthUser>;
  storeRefreshToken(userId: string, hash: string, expiresAt: Date): Promise<void>;
  findLiveRefreshToken(hash: string): Promise<StoredRefreshToken | undefined>;
  revokeRefreshToken(id: string): Promise<void>;
  revokeAllForUser(userId: string): Promise<void>;
  close(): Promise<void>;
};

/**
 * The migrate service owns schema and roles. Auth only reads and writes rows.
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
      const rows = await sql<
        { id: string; email: string; password_hash: string }[]
      >`select id, email, password_hash from auth.users where email = ${email}`;
      const row = rows[0];
      if (!row) {
        return undefined;
      }
      return { id: row.id, email: row.email, passwordHash: row.password_hash };
    },
    async findById(id) {
      const rows = await sql<
        { id: string; email: string }[]
      >`select id, email from auth.users where id = ${id}`;
      return rows[0];
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
    async revokeAllForUser(userId) {
      await sql`update auth.refresh_tokens set revoked_at = now()
        where user_id = ${userId} and revoked_at is null`;
    },
    async close() {
      await sql.end();
    },
  };
}
