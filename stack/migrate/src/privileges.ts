import type postgres from "postgres";

/**
 * Who may reach which schema, asserted on every start rather than granted in a
 * migration that runs once. A restore can bring back a database from before the
 * grants existed, and the services then fail with "permission denied for schema
 * auth" while every migration reports itself as applied.
 */
export async function ensurePrivileges(sql: postgres.Sql): Promise<void> {
  const statements = [
    "REVOKE ALL ON SCHEMA public FROM PUBLIC",
    "GRANT USAGE ON SCHEMA public TO anon",
    "GRANT USAGE ON SCHEMA public TO app_user",

    "REVOKE ALL ON SCHEMA auth FROM PUBLIC",
    "GRANT USAGE ON SCHEMA auth TO auth_service",
    "GRANT SELECT, INSERT ON auth.users TO auth_service",
    // Column-limited: a new password hash and the timestamps beside it, never
    // the email address, and never a DELETE.
    "GRANT UPDATE (password_hash, email_confirmed_at, last_sign_in_at, updated_at) ON auth.users TO auth_service",
    "GRANT SELECT, INSERT, UPDATE, DELETE ON auth.refresh_tokens TO auth_service",
    "GRANT SELECT, INSERT, UPDATE, DELETE ON auth.one_time_tokens TO auth_service",

    "REVOKE ALL ON SCHEMA storage FROM PUBLIC",
    "GRANT USAGE ON SCHEMA storage TO app_user",
    "GRANT USAGE ON SCHEMA storage TO storage_service",

    "GRANT USAGE ON SCHEMA baseplate TO app_user",
  ];
  for (const statement of statements) {
    await sql.unsafe(statement).simple();
  }
}
