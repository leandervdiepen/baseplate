import postgres from "postgres";
import type { AuthUser } from "./token.ts";

export type AuthDb = {
  findByEmail(email: string): Promise<(AuthUser & { passwordHash: string }) | undefined>;
  findById(id: string): Promise<AuthUser | undefined>;
  insertUser(email: string, passwordHash: string): Promise<AuthUser>;
  close(): Promise<void>;
};

export async function connectAuthDb(config: {
  postgresPassword: string;
  authPassword: string;
}): Promise<AuthDb> {
  const admin = postgres({
    host: "postgres",
    database: "app",
    username: "postgres",
    password: config.postgresPassword,
    max: 1,
  });
  await migrate(admin, config.authPassword);
  await admin.end();
  const sql = postgres({
    host: "postgres",
    database: "app",
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
    async close() {
      await sql.end();
    },
  };
}

async function migrate(sql: postgres.Sql, authPassword: string): Promise<void> {
  await sql`create schema if not exists auth`;
  await sql`create table if not exists auth.users (
    id uuid primary key default gen_random_uuid(),
    email text not null unique,
    password_hash text not null,
    created_at timestamptz not null default now()
  )`;
  await sql.unsafe(
    `do $role$ begin
      if not exists (select 1 from pg_roles where rolname = 'auth_service') then
        create role auth_service login password '${escapeLiteral(authPassword)}';
      else
        alter role auth_service with login password '${escapeLiteral(authPassword)}';
      end if;
    end $role$`,
  );
  await sql`revoke all on schema auth from public`;
  await sql`grant usage on schema auth to auth_service`;
  await sql`grant select, insert on auth.users to auth_service`;
}

function escapeLiteral(value: string): string {
  return value.replaceAll("'", "''");
}
