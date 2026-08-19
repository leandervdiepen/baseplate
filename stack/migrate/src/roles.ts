import type postgres from "postgres";

export type RolePasswords = {
  authenticator: string;
  authService: string;
};

/**
 * Roles carry passwords from the environment, so they are ensured in code
 * rather than in a migration file that is committed to the repo.
 */
export async function ensureRoles(
  sql: postgres.Sql,
  passwords: RolePasswords,
): Promise<void> {
  await ensureRole(sql, "anon", undefined);
  await ensureRole(sql, "app_user", undefined);
  await ensureRole(sql, "authenticator", passwords.authenticator);
  await ensureRole(sql, "auth_service", passwords.authService);
  await sql.unsafe("GRANT anon TO authenticator");
  await sql.unsafe("GRANT app_user TO authenticator");
  await sql.unsafe("ALTER ROLE authenticator NOINHERIT");
}

async function ensureRole(
  sql: postgres.Sql,
  name: string,
  password: string | undefined,
): Promise<void> {
  const login = password ? `LOGIN PASSWORD ${literal(password)}` : "NOLOGIN";
  await sql.unsafe(`DO $ensure$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = ${literal(name)}) THEN
    CREATE ROLE ${identifier(name)} ${login};
  ELSE
    ALTER ROLE ${identifier(name)} WITH ${login};
  END IF;
END
$ensure$`);
}

export function identifier(name: string): string {
  if (!/^[a-z_][a-z0-9_]*$/.test(name)) {
    throw new Error(`Refusing to use '${name}' as a SQL identifier.`);
  }
  return `"${name}"`;
}

export function literal(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}
