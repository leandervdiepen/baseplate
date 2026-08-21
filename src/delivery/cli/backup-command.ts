import type { ManageBackups } from "#application";
import { DomainError } from "#domain";
import { formatBytes } from "./storage-command.ts";

export const BACKUP_USAGE = `Usage: baseplate backup <command>

  now                      Take a backup and wait for it to finish
  list                     What has been backed up, newest first
  drill                    Restore the newest backup into a scratch database
                           and count what comes back
  drills                   What every drill so far found

Backups run on a schedule wherever the database is. BACKUP_EVERY, BACKUP_KEEP,
and DRILL_EVERY set the pace, and BACKUP_S3_* send them off the machine.

To put one back: baseplate restore [<id>]`;

export async function runBackupCommand(
  backups: ManageBackups,
  action: string | undefined,
  print: (line: string) => void,
): Promise<void> {
  if (action === undefined || action === "help") {
    print(BACKUP_USAGE);
    return;
  }

  if (action === "now" || action === "drill") {
    print(action === "now" ? "Backing up…" : "Restoring the newest backup into a scratch database…");
    const outcome = await backups.run(action === "now" ? "backup" : "drill");
    print(outcome.message);
    return;
  }

  if (action === "list") {
    const records = await backups.list();
    if (records.length === 0) {
      print("Nothing backed up yet. `baseplate backup now` takes one.");
      return;
    }
    for (const record of records) {
      const when = record.finishedAt ? new Date(record.finishedAt).toISOString() : "running";
      const state = record.ok ? formatBytes(record.bytes) : `failed: ${record.message ?? ""}`;
      print(`${String(record.id).padStart(4)}  ${when}  ${state}  ${record.destination}`);
    }
    return;
  }

  if (action === "drills") {
    const records = await backups.drills();
    if (records.length === 0) {
      print("No drill has run yet. `baseplate backup drill` runs one now.");
      return;
    }
    for (const record of records) {
      const mark = record.ok ? "ok  " : "FAIL";
      print(
        `${mark}  ${new Date(record.ranAt).toISOString()}  ${String(record.tables)} table(s), ${String(record.rows)} row(s), ${String(record.durationMs)}ms  ${record.message ?? ""}`,
      );
    }
    return;
  }

  throw new DomainError(
    "cli.unknown_backup_command",
    `Unknown backup command '${action}'.\n\n${BACKUP_USAGE}`,
  );
}

/**
 * Puts a backup back over the live database. Everything since it is gone, and
 * the API errors while it runs, so it asks first.
 */
export async function runRestoreCommand(
  backups: ManageBackups,
  rawId: string | undefined,
  confirm: () => Promise<boolean>,
  print: (line: string) => void,
): Promise<void> {
  const id = rawId === undefined ? undefined : Number(rawId);
  if (id !== undefined && !Number.isInteger(id)) {
    throw new DomainError("cli.invalid_backup_id", `'${rawId}' is not a backup id. Try \`baseplate backup list\`.`);
  }
  if (!(await confirm())) {
    throw new DomainError("cli.not_confirmed", "Nothing was restored.");
  }
  print("Restoring…");
  print((await backups.restore(id)).message);
}
