import type postgres from "postgres";
import { checksum, readMigrations, splitStatements } from "./files.ts";
import { readLedger, recordMigration } from "./ledger.ts";

export type MigrationSource = {
  label: string;
  dir: string;
};

/**
 * Platform files run before app files. Ledger names carry the source label so
 * the two directories can number themselves independently.
 */
export async function applyMigrations(
  sql: postgres.Sql,
  sources: readonly MigrationSource[],
  log: (line: string) => void,
): Promise<number> {
  const applied = await readLedger(sql);
  let count = 0;
  for (const source of sources) {
    for (const file of readMigrations(source.dir)) {
      const key = `${source.label}/${file.name}`;
      const digest = checksum(file.text);
      const seen = applied.get(key);
      if (seen === digest) {
        continue;
      }
      if (seen !== undefined) {
        throw new Error(
          `Migration ${key} changed after it was applied. Add a new migration instead of editing an applied one.`,
        );
      }
      await sql.begin(async (tx) => {
        for (const statement of splitStatements(file.text)) {
          await tx.unsafe(statement).simple();
        }
        await recordMigration(tx, key, digest);
      });
      log(`applied ${key}`);
      count += 1;
    }
  }
  return count;
}
