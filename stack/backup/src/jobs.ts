import { rm } from "node:fs/promises";
import { join } from "node:path";
import { backupKey, openFile, sealFile } from "../../shared/crypto.ts";
import type { BackupDb, BackupRow } from "./db.ts";
import type { Destination } from "./destination.ts";
import type { postgresTools } from "./postgres-tools.ts";

export type Jobs = ReturnType<typeof createJobs>;

export type JobConfig = {
  db: BackupDb;
  destination: Destination;
  tools: ReturnType<typeof postgresTools>;
  key: string;
  database: string;
  scratch: string;
  keep: number;
  log: (line: string) => void;
};

const DRILL_DATABASE = "baseplate_drill";

export function createJobs(config: JobConfig) {
  const key = backupKey(config.key);

  async function backup(stamp: string): Promise<BackupRow> {
    const objectKey = `db/${stamp}.dump.enc`;
    const startedAt = new Date();
    const plain = join(config.scratch, `${stamp}.dump`);
    const sealed = join(config.scratch, `${stamp}.dump.enc`);
    try {
      await config.tools.dump(plain);
      const result = await sealFile(key, plain, sealed);
      await config.destination.put(objectKey, sealed);
      const id = await config.db.recordBackup({
        key: objectKey,
        destination: config.destination.label,
        startedAt,
        bytes: result.bytes,
        sha256: result.sha256,
        ok: true,
        message: null,
      });
      config.log(`backed up ${objectKey} (${String(result.bytes)} bytes) to ${config.destination.label}`);
      await prune();
      return { id, key: objectKey, bytes: result.bytes, sha256: result.sha256, ok: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await config.db.recordBackup({
        key: objectKey,
        destination: config.destination.label,
        startedAt,
        bytes: 0,
        sha256: "",
        ok: false,
        message,
      });
      throw error;
    } finally {
      await rm(plain, { force: true });
      await rm(sealed, { force: true });
    }
  }

  async function prune(): Promise<void> {
    for (const old of await config.db.beyond(config.keep)) {
      await config.destination.remove(old.key);
      await config.db.forget(old.id);
      config.log(`pruned ${old.key}`);
    }
  }

  /**
   * The whole chain, not just the dump: fetch what was actually stored, open
   * it, restore it into a database of its own, and count what came back. A
   * backup nobody has restored is a hope.
   */
  async function drill(backupRow: BackupRow | undefined): Promise<void> {
    const started = Date.now();
    if (!backupRow) {
      await config.db.recordDrill({
        backupId: null,
        ok: false,
        tables: 0,
        rows: 0,
        durationMs: 0,
        message: "There is no backup to restore yet.",
      });
      return;
    }
    const sealed = join(config.scratch, "drill.enc");
    const plain = join(config.scratch, "drill.dump");
    try {
      await config.destination.fetch(backupRow.key, sealed);
      await openFile(key, sealed, plain);
      await config.tools.psql("postgres", `DROP DATABASE IF EXISTS ${DRILL_DATABASE}`);
      await config.tools.psql("postgres", `CREATE DATABASE ${DRILL_DATABASE}`);
      await config.tools.restore(plain, DRILL_DATABASE, false);

      const tables = await config.db.declaredTables();
      let rows = 0;
      for (const table of tables) {
        const counted = await config.tools.psql(
          DRILL_DATABASE,
          `SELECT count(*) FROM public."${table}"`,
        );
        rows += Number(counted) || 0;
      }
      const users = Number(
        await config.tools.psql(DRILL_DATABASE, "SELECT count(*) FROM auth.users"),
      );

      await config.db.recordDrill({
        backupId: backupRow.id,
        ok: true,
        tables: tables.length,
        rows,
        durationMs: Date.now() - started,
        message: `${String(tables.length)} table(s), ${String(rows)} row(s), ${String(users)} user(s) restored and counted.`,
      });
      config.log(`drill ok: ${String(tables.length)} table(s), ${String(rows)} row(s)`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await config.db.recordDrill({
        backupId: backupRow.id,
        ok: false,
        tables: 0,
        rows: 0,
        durationMs: Date.now() - started,
        message,
      });
      throw error;
    } finally {
      await config.tools
        .psql("postgres", `DROP DATABASE IF EXISTS ${DRILL_DATABASE}`)
        .catch(() => undefined);
      await rm(sealed, { force: true });
      await rm(plain, { force: true });
    }
  }

  /**
   * Over the live database, which is what a restore is for. In-flight requests
   * will fail while it runs; that is downtime, and it is expected.
   */
  async function restore(backupRow: BackupRow): Promise<void> {
    const sealed = join(config.scratch, "restore.enc");
    const plain = join(config.scratch, "restore.dump");
    try {
      await config.destination.fetch(backupRow.key, sealed);
      await openFile(key, sealed, plain);
      await config.tools.restore(plain, config.database, true);
      // The restored database is from before this backup was recorded, so its
      // own row is not in it. Put it back, or restoring from it once would be
      // the last time it could be used.
      await config.db.recordBackup({
        key: backupRow.key,
        destination: config.destination.label,
        startedAt: new Date(),
        bytes: backupRow.bytes,
        sha256: backupRow.sha256,
        ok: true,
        message: "Restored from this backup.",
      });
      config.log(`restored ${backupRow.key} over ${config.database}`);
    } finally {
      await rm(sealed, { force: true });
      await rm(plain, { force: true });
    }
  }

  return { backup, drill, restore, prune };
}
