import postgres from "postgres";
import type {
  BackupAdmin,
  BackupRecord,
  DrillRecord,
  RequestOutcome,
} from "#application";
import { InfraError } from "#shared";
import type { PostgresAdminConfig } from "./schema-admin.ts";

const POLL_MS = 500;

export class PostgresBackupAdmin implements BackupAdmin {
  private readonly sql: postgres.Sql;

  constructor(config: PostgresAdminConfig) {
    this.sql = postgres({
      host: config.host,
      port: config.port,
      database: config.database,
      username: "postgres",
      password: config.password,
      max: 2,
      idle_timeout: 5,
      connect_timeout: 10,
      onnotice: () => undefined,
    });
  }

  async list(limit: number): Promise<readonly BackupRecord[]> {
    const rows = await this.sql<
      {
        id: number;
        key: string;
        bytes: string;
        destination: string;
        finished_at: Date | null;
        ok: boolean;
        message: string | null;
      }[]
    >`
      SELECT id, key, bytes::text, destination, finished_at, ok, message
      FROM baseplate.backups
      ORDER BY started_at DESC
      LIMIT ${limit}`;
    return rows.map((row) => ({
      id: row.id,
      key: row.key,
      bytes: Number(row.bytes),
      destination: row.destination,
      finishedAt: row.finished_at?.toISOString() ?? null,
      ok: row.ok,
      message: row.message,
    }));
  }

  async drills(limit: number): Promise<readonly DrillRecord[]> {
    const rows = await this.sql<
      {
        id: number;
        backup_id: number | null;
        ran_at: Date;
        ok: boolean;
        tables: number;
        rows_restored: string;
        duration_ms: number;
        message: string | null;
      }[]
    >`
      SELECT id, backup_id, ran_at, ok, tables, rows_restored::text, duration_ms, message
      FROM baseplate.restore_drills
      ORDER BY ran_at DESC
      LIMIT ${limit}`;
    return rows.map((row) => ({
      id: row.id,
      backupId: row.backup_id,
      ranAt: row.ran_at.toISOString(),
      ok: row.ok,
      tables: row.tables,
      rows: Number(row.rows_restored),
      durationMs: row.duration_ms,
      message: row.message,
    }));
  }

  /**
   * Writes the request, nudges the service, then waits for it to write back.
   * A dump of a real database takes longer than an HTTP request should, so the
   * caller decides how long it is willing to wait.
   */
  async request(
    kind: "backup" | "drill" | "restore",
    backupId: number | undefined,
    timeoutMs: number,
  ): Promise<RequestOutcome> {
    const rows = await this.sql<{ id: number }[]>`
      INSERT INTO baseplate_control.backup_requests (kind, backup_id)
      VALUES (${kind}, ${backupId ?? null})
      RETURNING id`;
    const id = rows[0]?.id;
    if (id === undefined) {
      throw new InfraError("backup.not_queued", "Could not queue that request.");
    }
    await this.sql.unsafe("NOTIFY baseplate_backup").simple();

    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const found = await this.sql<{ finished: boolean; ok: boolean | null; message: string | null }[]>`
        SELECT finished_at IS NOT NULL AS finished, ok, message
        FROM baseplate_control.backup_requests WHERE id = ${id}`;
      const row = found[0];
      if (row?.finished) {
        return { ok: row.ok === true, message: row.message ?? "" };
      }
      // The row is gone. A restore from before this queue existed takes it with
      // everything else, so say what happened rather than waiting out the clock.
      if (!row) {
        return {
          ok: true,
          message:
            "Done. That backup predates this queue, so the record of asking went with the restore.",
        };
      }
      await new Promise((resolve) => setTimeout(resolve, POLL_MS));
    }
    throw new InfraError(
      "backup.timed_out",
      "The backup service did not answer in time. It may still be working; check the list in a moment.",
    );
  }

  async close(): Promise<void> {
    await this.sql.end();
  }
}
