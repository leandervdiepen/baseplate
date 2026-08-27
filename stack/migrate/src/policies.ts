import type postgres from "postgres";
import { identifier } from "./roles.ts";

/** Mirrors the `TableAccess` the studio writes into `baseplate.tables`. */
export type TableAccess = "private" | "shared" | "public";

export type DeclaredPolicy = {
  table: string;
  ownerColumn: string;
  access: TableAccess;
};

/**
 * Who is asking, or null when nobody is. The empty string becomes null before
 * the cast, not after: a transaction-local `set_config` reverts to `''` rather
 * than unset, and casting that to json would raise for every later caller on
 * the same pooled connection.
 */
const CALLER_SQL = `CREATE OR REPLACE FUNCTION baseplate.caller_id() RETURNS uuid
LANGUAGE sql STABLE AS $caller$
  SELECT nullif(
    nullif(current_setting('request.jwt.claims', true), '')::json ->> 'sub',
    ''
  )::uuid
$caller$`;

/**
 * `baseplate.tables` is the single source of truth for who can read a row.
 * The operator changes it from the dashboard; this makes the database match.
 */
export async function readDeclaredPolicies(
  sql: postgres.Sql,
): Promise<DeclaredPolicy[]> {
  const rows = await sql<{ name: string; owner_column: string; access: string }[]>`
    SELECT name, owner_column, access FROM baseplate.tables ORDER BY name`;
  return rows.map((row) => ({
    table: row.name,
    ownerColumn: row.owner_column,
    access: row.access as TableAccess,
  }));
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
    log(`policy ${policy.table} on ${policy.ownerColumn} (${policy.access})`);
  }
  for (const table of await publicTables(sql)) {
    if (!declared.has(table)) {
      await lockDown(sql, table);
      log(`locked ${table} (no declared policy)`);
    }
  }
  await applyStoragePolicies(sql);
  log("policy storage.objects on owner_id");
  await sql.unsafe("NOTIFY pgrst, 'reload schema'").simple();
}

/**
 * An object is a row, so it is guarded the same way a row is: the caller sees
 * their own, and a bucket the operator marked public is readable by anyone
 * holding a token. Re-applied on every start, like every other policy here.
 */
export async function applyStoragePolicies(sql: postgres.Sql): Promise<void> {
  const objects = "storage.objects";
  await sql.unsafe(`ALTER TABLE ${objects} ENABLE ROW LEVEL SECURITY`).simple();
  await sql.unsafe(`DROP POLICY IF EXISTS objects_owner ON ${objects}`).simple();
  await sql.unsafe(`CREATE POLICY objects_owner ON ${objects}
    USING (owner_id = baseplate.caller_id())
    WITH CHECK (owner_id = baseplate.caller_id())`).simple();

  await sql.unsafe(`DROP POLICY IF EXISTS objects_public_read ON ${objects}`).simple();
  await sql.unsafe(`CREATE POLICY objects_public_read ON ${objects} FOR SELECT
    USING (EXISTS (
      SELECT 1 FROM storage.buckets b
      WHERE b.name = ${objects}.bucket AND b.public
    ))`).simple();

  // The policy above reads storage.buckets as the caller, so the caller needs
  // to be allowed to.
  await sql.unsafe("GRANT SELECT ON storage.buckets TO app_user").simple();
  await sql
    .unsafe(`GRANT SELECT, INSERT, UPDATE, DELETE ON ${objects} TO app_user`)
    .simple();
  await sql.unsafe("GRANT SELECT ON storage.buckets TO storage_service").simple();
  await sql.unsafe("REVOKE ALL ON storage.buckets FROM anon").simple();
  await sql.unsafe(`REVOKE ALL ON ${objects} FROM anon`).simple();
}

async function applyPolicy(sql: postgres.Sql, policy: DeclaredPolicy): Promise<void> {
  const table = identifier(policy.table);
  const owner = identifier(policy.ownerColumn);
  const owned = identifier(`${policy.table}_owner`);
  const readAll = identifier(`${policy.table}_read_all`);
  const trigger = identifier(`${policy.table}_set_owner`);
  const setter = identifier(`set_owner_${policy.table}`);
  const match = `${owner} = baseplate.caller_id()`;
  const visible = readCondition(policy.access);

  await sql.unsafe(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY`).simple();
  await sql.unsafe(`DROP POLICY IF EXISTS ${owned} ON public.${table}`).simple();
  await sql.unsafe(`CREATE POLICY ${owned} ON public.${table}
    USING (${match}) WITH CHECK (${match})`).simple();

  await sql.unsafe(`DROP POLICY IF EXISTS ${readAll} ON public.${table}`).simple();
  if (visible) {
    await sql.unsafe(`CREATE POLICY ${readAll} ON public.${table}
      FOR SELECT USING (${visible})`).simple();
  }

  await sql.unsafe(`CREATE OR REPLACE FUNCTION baseplate.${setter}() RETURNS trigger
LANGUAGE plpgsql AS $owner$
BEGIN
  NEW.${owner} := coalesce(baseplate.caller_id(), NEW.${owner});
  RETURN NEW;
END
$owner$`).simple();
  await sql.unsafe(`DROP TRIGGER IF EXISTS ${trigger} ON public.${table}`).simple();
  await sql.unsafe(`CREATE TRIGGER ${trigger} BEFORE INSERT ON public.${table}
    FOR EACH ROW EXECUTE FUNCTION baseplate.${setter}()`).simple();

  await sql.unsafe(`REVOKE ALL ON public.${table} FROM anon`).simple();
  if (policy.access === "public") {
    await sql.unsafe(`GRANT SELECT ON public.${table} TO anon`).simple();
  }
  await sql
    .unsafe(`GRANT SELECT, INSERT, UPDATE, DELETE ON public.${table} TO app_user`)
    .simple();
}

/** What a read has to satisfy beyond owning the row, or nothing for private. */
function readCondition(access: TableAccess): string {
  if (access === "shared") {
    return "baseplate.caller_id() IS NOT NULL";
  }
  if (access === "public") {
    return "true";
  }
  return "";
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
