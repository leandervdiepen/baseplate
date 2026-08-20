import postgres from "postgres";

export type BackupRow = {
  id: number;
  key: string;
  bytes: number;
  sha256: string;
  ok: boolean;
};

export type PendingRequest = {
  id: number;
  kind: "backup" | "drill" | "restore";
  backupId: number | null;
};

export type BackupDb = ReturnType<typeof connectBackupDb>;

export function connectBackupDb(config: { password: string; host: string; database: string }) {
  const sql = postgres({
    host: config.host,
    database: config.database,
    username: "postgres",
    password: config.password,
    max: 2,
    onnotice: () => undefined,
  });

  return {
    /**
     * Recorded once the outcome is known, never before.
     *
     * A row written first would be inside the dump that follows it, saying a
     * backup is running and never finishing, and every restore would bring that
     * ghost back. The started_at is passed in so the duration is still true.
     */
    async recordBackup(record: {
      key: string;
      destination: string;
      startedAt: Date;
      bytes: number;
      sha256: string;
      ok: boolean;
      message: string | null;
    }): Promise<number> {
      const rows = await sql<{ id: number }[]>`
        INSERT INTO baseplate.backups
          (key, bytes, sha256, destination, started_at, finished_at, ok, message)
        VALUES (${record.key}, ${record.bytes}, ${record.sha256}, ${record.destination},
                ${record.startedAt}, now(), ${record.ok}, ${record.message})
        ON CONFLICT (key) DO UPDATE
          SET bytes = EXCLUDED.bytes, sha256 = EXCLUDED.sha256,
              finished_at = EXCLUDED.finished_at, ok = EXCLUDED.ok,
              message = EXCLUDED.message
        RETURNING id`;
      const row = rows[0];
      if (!row) {
        throw new Error("Could not record the backup.");
      }
      return row.id;
    },

    async newest(): Promise<BackupRow | undefined> {
      const rows = await sql<BackupRow[]>`
        SELECT id, key, bytes, sha256, ok FROM baseplate.backups
        WHERE ok ORDER BY finished_at DESC LIMIT 1`;
      return rows[0];
    },

    async byId(id: number): Promise<BackupRow | undefined> {
      const rows = await sql<BackupRow[]>`
        SELECT id, key, bytes, sha256, ok FROM baseplate.backups WHERE id = ${id} AND ok`;
      return rows[0];
    },

    /** Oldest first, so pruning takes from the far end. */
    async beyond(keep: number): Promise<BackupRow[]> {
      return sql<BackupRow[]>`
        SELECT id, key, bytes, sha256, ok FROM baseplate.backups
        WHERE ok ORDER BY finished_at DESC OFFSET ${keep}`;
    },

    async forget(id: number): Promise<void> {
      await sql`DELETE FROM baseplate.backups WHERE id = ${id}`;
    },

    async recordDrill(result: {
      backupId: number | null;
      ok: boolean;
      tables: number;
      rows: number;
      durationMs: number;
      message: string | null;
    }): Promise<void> {
      await sql`
        INSERT INTO baseplate.restore_drills
          (backup_id, ok, tables, rows_restored, duration_ms, message)
        VALUES (${result.backupId}, ${result.ok}, ${result.tables}, ${result.rows},
                ${result.durationMs}, ${result.message})`;
    },

    async lastDrillAt(): Promise<Date | undefined> {
      const rows = await sql<{ ran_at: Date }[]>`
        SELECT ran_at FROM baseplate.restore_drills ORDER BY ran_at DESC LIMIT 1`;
      return rows[0]?.ran_at;
    },

    async lastBackupAt(): Promise<Date | undefined> {
      const rows = await sql<{ finished_at: Date }[]>`
        SELECT finished_at FROM baseplate.backups
        WHERE ok AND finished_at IS NOT NULL ORDER BY finished_at DESC LIMIT 1`;
      return rows[0]?.finished_at;
    },

    async claimRequest(): Promise<PendingRequest | undefined> {
      const rows = await sql<{ id: number; kind: string; backup_id: number | null }[]>`
        UPDATE baseplate_control.backup_requests SET started_at = now()
        WHERE id = (
          SELECT id FROM baseplate_control.backup_requests
          WHERE finished_at IS NULL AND started_at IS NULL
          ORDER BY requested_at LIMIT 1 FOR UPDATE SKIP LOCKED
        )
        RETURNING id, kind, backup_id`;
      const row = rows[0];
      if (!row) {
        return undefined;
      }
      return {
        id: row.id,
        kind: row.kind as PendingRequest["kind"],
        backupId: row.backup_id,
      };
    },

    async finishRequest(id: number, ok: boolean, message: string): Promise<void> {
      await sql`
        UPDATE baseplate_control.backup_requests
        SET finished_at = now(), ok = ${ok}, message = ${message}
        WHERE id = ${id}`;
    },

    /** Every table the operator declared, so a drill knows what to count. */
    async declaredTables(): Promise<string[]> {
      const rows = await sql<{ name: string }[]>`SELECT name FROM baseplate.tables ORDER BY name`;
      return rows.map((row) => row.name);
    },

    listen(channel: string, onNotify: () => void): Promise<unknown> {
      return sql.listen(channel, onNotify);
    },

    async close(): Promise<void> {
      await sql.end();
    },
  };
}
