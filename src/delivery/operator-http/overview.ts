import type { ServerResponse } from "node:http";
import { createOperatorFor, type OperatorRoots } from "../operator-setup.ts";
import { sendJson } from "./json.ts";

export type Overview = {
  live: boolean;
  tables: number;
  rowsTracked: number;
  buckets: number;
  objects: number;
  objectBytes: number;
  lastChange: { change: string; appliedAt: string } | null;
  lastBackup: { at: string; bytes: number; destination: string; ok: boolean } | null;
  lastDrill: { at: string; ok: boolean; tables: number; rows: number; durationMs: number } | null;
};

const EMPTY: Overview = {
  live: false,
  tables: 0,
  rowsTracked: 0,
  buckets: 0,
  objects: 0,
  objectBytes: 0,
  lastChange: null,
  lastBackup: null,
  lastDrill: null,
};

/**
 * One read for the front page. Every part is optional: a stack that is half up,
 * or a project that has never been backed up, should still render a page rather
 * than an error, so each piece falls back on its own.
 */
export async function handleOverview(roots: OperatorRoots, res: ServerResponse): Promise<void> {
  let operator;
  try {
    operator = createOperatorFor(roots, true);
  } catch {
    sendJson(res, 200, EMPTY);
    return;
  }
  try {
    const [tables, history, usage, backups, drills] = await Promise.all([
      operator.admin.listTables().catch(() => []),
      operator.admin.history(1).catch(() => []),
      operator.storage.usage().catch(() => []),
      operator.backups.list(1).catch(() => []),
      operator.backups.drills(1).catch(() => []),
    ]);
    const change = history[0];
    const backup = backups[0];
    const drill = drills[0];

    sendJson(res, 200, {
      live: true,
      tables: tables.length,
      rowsTracked: tables.reduce((total, table) => total + table.columns.length, 0),
      buckets: usage.length,
      objects: usage.reduce((total, bucket) => total + bucket.objects, 0),
      objectBytes: usage.reduce((total, bucket) => total + bucket.bytes, 0),
      lastChange: change ? { change: change.change, appliedAt: change.appliedAt } : null,
      lastBackup: backup
        ? {
            at: backup.finishedAt ?? "",
            bytes: backup.bytes,
            destination: backup.destination,
            ok: backup.ok,
          }
        : null,
      lastDrill: drill
        ? {
            at: drill.ranAt,
            ok: drill.ok,
            tables: drill.tables,
            rows: drill.rows,
            durationMs: drill.durationMs,
          }
        : null,
    } satisfies Overview);
  } catch {
    sendJson(res, 200, EMPTY);
  } finally {
    await operator.admin.close();
    await operator.storage.close();
    await operator.backups.close();
  }
}
