import type postgres from "postgres";

export type AppliedMigration = {
  name: string;
  checksum: string;
};

export async function ensureLedger(sql: postgres.Sql): Promise<void> {
  await sql`CREATE SCHEMA IF NOT EXISTS baseplate`;
  await sql`CREATE TABLE IF NOT EXISTS baseplate.migrations (
    name text PRIMARY KEY,
    checksum text NOT NULL,
    applied_at timestamptz NOT NULL DEFAULT now()
  )`;
}

export async function readLedger(sql: postgres.Sql): Promise<Map<string, string>> {
  const rows = await sql<
    AppliedMigration[]
  >`SELECT name, checksum FROM baseplate.migrations`;
  return new Map(rows.map((row) => [row.name, row.checksum]));
}

export async function recordMigration(
  sql: postgres.TransactionSql,
  name: string,
  digest: string,
): Promise<void> {
  await sql`INSERT INTO baseplate.migrations (name, checksum)
    VALUES (${name}, ${digest})
    ON CONFLICT (name) DO UPDATE SET checksum = EXCLUDED.checksum`;
}
