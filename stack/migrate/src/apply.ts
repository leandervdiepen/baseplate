import type postgres from "postgres";
import { checksum, readMigrations, splitStatements } from "./files.ts";
import { readLedger, recordMigration } from "./ledger.ts";

export async function applyMigrations(
  sql: postgres.Sql,
  dir: string,
  log: (line: string) => void,
): Promise<number> {
  const applied = await readLedger(sql);
  let count = 0;
  for (const file of readMigrations(dir)) {
    const digest = checksum(file.text);
    const seen = applied.get(file.name);
    if (seen === digest) {
      continue;
    }
    if (seen !== undefined) {
      throw new Error(
        `Migration ${file.name} changed after it was applied. Add a new migration instead of editing an applied one.`,
      );
    }
    await sql.begin(async (tx) => {
      for (const statement of splitStatements(file.text)) {
        await tx.unsafe(statement).simple();
      }
      await recordMigration(tx, file.name, digest);
    });
    log(`applied ${file.name}`);
    count += 1;
  }
  return count;
}
