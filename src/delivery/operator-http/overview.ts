import type { ServerResponse } from "node:http";
import { createOperatorFor, type OperatorRoots } from "../operator-setup.ts";
import { sendJson } from "./json.ts";
import { type Problem, problemFrom } from "./problem.ts";

export type Overview = {
  live: boolean;
  /** Why it is not live, when it is not. */
  problem?: Problem;
  tables: number;
  rowsTracked: number;
  /** Tables anyone but the row's owner can read, which is the notable count. */
  tablesWiderThanPrivate: number;
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
  tablesWiderThanPrivate: 0,
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
    operator = await createOperatorFor(roots, true);
  } catch (error) {
    sendJson(res, 200, { ...EMPTY, problem: problemFrom(error) });
    return;
  }
  try {
    const [tables, history, buckets, backups, drills] = await Promise.all([
      operator.schema.tables().catch(() => []),
      operator.schema.history(1).catch(() => []),
      operator.storage.buckets().catch(() => []),
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
      tablesWiderThanPrivate: tables.filter((table) => table.access !== "private").length,
      buckets: buckets.length,
      objects: buckets.reduce((total, bucket) => total + bucket.objects, 0),
      objectBytes: buckets.reduce((total, bucket) => total + bucket.bytes, 0),
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
  } catch (error) {
    sendJson(res, 200, { ...EMPTY, problem: problemFrom(error) });
  } finally {
    await operator.close();
  }
}
