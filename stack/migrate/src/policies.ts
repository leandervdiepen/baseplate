import type postgres from "postgres";
import { identifier } from "./roles.ts";

export type DeclaredPolicy = {
  table: string;
  ownerColumn: string;
};

const CALLER_SQL = `CREATE OR REPLACE FUNCTION baseplate.caller_id() RETURNS uuid
LANGUAGE sql STABLE AS $caller$
  SELECT nullif(current_setting('request.jwt.claims', true)::json ->> 'sub', '')::uuid
$caller$`;

/**
 * `baseplate.tables` is the single source of truth for who can read a row.
 * The operator changes it from the dashboard; this makes the database match.
 */
export async function readDeclaredPolicies(
  sql: postgres.Sql,
): Promise<DeclaredPolicy[]> {
  const rows = await sql<{ name: string; owner_column: string }[]>`
    SELECT name, owner_column FROM baseplate.tables ORDER BY name`;
  return rows.map((row) => ({ table: row.name, ownerColumn: row.owner_column }));
}

export async function syncPolicies(
  sql: postgres.Sql,
  policies: readonly DeclaredPolicy[],
  log: (line: string) => void,
): Promise<void> {
  await sql`CREATE SCHEMA IF NOT EXISTS baseplate`;
  await sql`GRANT USAGE ON SCHEMA baseplate TO app_user`;
  await sql.unsafe(CALLER_SQL).simple();
  await sql.unsafe("DROP FUNCTION IF EXISTS public.set_owner_id() CASCADE").simple();

  const declared = new Set(policies.map((policy) => policy.table));
  for (const policy of policies) {
    await applyPolicy(sql, policy);
    log(`policy ${policy.table} on ${policy.ownerColumn}`);
  }
  for (const table of await publicTables(sql)) {
    if (!declared.has(table)) {
      await lockDown(sql, table);
      log(`locked ${table} (no declared policy)`);
    }
  }
  await sql.unsafe("NOTIFY pgrst, 'reload schema'").simple();
}

async function applyPolicy(sql: postgres.Sql, policy: DeclaredPolicy): Promise<void> {
  const table = identifier(policy.table);
  const owner = identifier(policy.ownerColumn);
  const trigger = identifier(`${policy.table}_set_owner`);
  const setter = identifier(`set_owner_${policy.table}`);
  const match = `${owner} = baseplate.caller_id()`;

  await sql.unsafe(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY`).simple();
  await sql
    .unsafe(`DROP POLICY IF EXISTS ${identifier(`${policy.table}_owner`)} ON public.${table}`)
    .simple();
  await sql.unsafe(`CREATE POLICY ${identifier(`${policy.table}_owner`)} ON public.${table}
    USING (${match}) WITH CHECK (${match})`).simple();

  await sql.unsafe(`CREATE OR REPLACE FUNCTION baseplate.${setter}() RETURNS trigger
LANGUAGE plpgsql AS $owner$
BEGIN
  NEW.${owner} := baseplate.caller_id();
  RETURN NEW;
END
$owner$`).simple();
  await sql.unsafe(`DROP TRIGGER IF EXISTS ${trigger} ON public.${table}`).simple();
  await sql.unsafe(`CREATE TRIGGER ${trigger} BEFORE INSERT ON public.${table}
    FOR EACH ROW EXECUTE FUNCTION baseplate.${setter}()`).simple();

  await sql.unsafe(`REVOKE ALL ON public.${table} FROM anon`).simple();
  await sql
    .unsafe(`GRANT SELECT, INSERT, UPDATE, DELETE ON public.${table} TO app_user`)
    .simple();
}

async function lockDown(sql: postgres.Sql, table: string): Promise<void> {
  const quoted = identifier(table);
  await sql.unsafe(`ALTER TABLE public.${quoted} ENABLE ROW LEVEL SECURITY`).simple();
  await sql.unsafe(`REVOKE ALL ON public.${quoted} FROM app_user`).simple();
  await sql.unsafe(`REVOKE ALL ON public.${quoted} FROM anon`).simple();
}

async function publicTables(sql: postgres.Sql): Promise<string[]> {
  const rows = await sql<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'`;
  return rows.map((row) => row.tablename);
}
