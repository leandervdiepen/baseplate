import { DomainError } from "#domain";
import type {
  BackupAdmin,
  BackupRecord,
  DrillRecord,
  RequestOutcome,
} from "../ports/backup-admin.ts";

export type ManageBackupsDeps = {
  backups: BackupAdmin;
};

/**
 * A dump, a seal, and an upload take longer than a request usually should.
 *
 * One number for every surface: the CLI waited ten minutes and the studio five,
 * so the same backup could be reported as failed in one and done in the other.
 */
const REQUEST_TIMEOUT_MS = 10 * 60_000;

/** Newest first, and enough of them to see whether this keeps happening. */
const HISTORY_LIMIT = 20;

/**
 * The backup service runs beside the database, so asking for work means writing
 * a row and waiting. How long to wait, and what a failed outcome means, are the
 * same wherever the operator asked from.
 */
export class ManageBackups {
  private readonly deps: ManageBackupsDeps;

  constructor(deps: ManageBackupsDeps) {
    this.deps = deps;
  }

  async list(limit: number = HISTORY_LIMIT): Promise<readonly BackupRecord[]> {
    return this.deps.backups.list(limit);
  }

  async drills(limit: number = HISTORY_LIMIT): Promise<readonly DrillRecord[]> {
    return this.deps.backups.drills(limit);
  }

  /** Takes a backup, or restores the newest into a scratch database and counts it. */
  async run(kind: "backup" | "drill"): Promise<RequestOutcome> {
    return this.waitFor(kind, undefined, "backup.failed");
  }

  /** Puts a backup back over the live database. The newest one when none is named. */
  async restore(id?: number): Promise<RequestOutcome> {
    return this.waitFor("restore", id, "backup.restore_failed");
  }

  /**
   * The service answers with an outcome either way, so a request that finished
   * badly is still a resolved promise. That is not something a caller should
   * have to remember to check.
   */
  private async waitFor(
    kind: "backup" | "drill" | "restore",
    backupId: number | undefined,
    failureCode: string,
  ): Promise<RequestOutcome> {
    const outcome = await this.deps.backups.request(kind, backupId, REQUEST_TIMEOUT_MS);
    if (!outcome.ok) {
      throw new DomainError(failureCode, outcome.message || "That did not work.");
    }
    return outcome;
  }
}
