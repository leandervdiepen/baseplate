import type postgres from "postgres";

/**
 * Who may reach which schema, re-applied on every start.
 *
 * These grants were only ever made inside migrations, which run once. A restore
 * brings back a database from before they existed, or one dumped without them,
 * and the services then fail with "permission denied for schema auth" while
 * every migration reports itself as already applied.
 *
 * So they are asserted here instead, the same way row access is: on every start,
 * from code, so a restore cannot leave the stack unable to sign anyone in.
 */
export async function ensurePrivileges(sql: postgres.Sql): Promise<void> {
  const statements = [
    "REVOKE ALL ON SCHEMA public FROM PUBLIC",
    "GRANT USAGE ON SCHEMA public TO anon",
    "GRANT USAGE ON SCHEMA public TO app_user",

    "REVOKE ALL ON SCHEMA auth FROM PUBLIC",
    "GRANT USAGE ON SCHEMA auth TO auth_service",
    "GRANT SELECT, INSERT ON auth.users TO auth_service",
    "GRANT SELECT, INSERT, UPDATE, DELETE ON auth.refresh_tokens TO auth_service",

    "REVOKE ALL ON SCHEMA storage FROM PUBLIC",
    "GRANT USAGE ON SCHEMA storage TO app_user",
    "GRANT USAGE ON SCHEMA storage TO storage_service",

    "GRANT USAGE ON SCHEMA baseplate TO app_user",
  ];
  for (const statement of statements) {
    await sql.unsafe(statement).simple();
  }
}
