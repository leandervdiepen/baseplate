import {
  ManageBackups,
  type BackupAdmin,
  type BackupRecord,
  type DrillRecord,
  type RequestOutcome,
} from "#application";
import { expect, test } from "vitest";

type Asked = {
  kind: "backup" | "drill" | "restore";
  backupId: number | undefined;
  timeoutMs: number;
};

class RecordingBackups implements BackupAdmin {
  readonly asked: Asked[] = [];
  readonly limits: { list: number[]; drills: number[] } = { list: [], drills: [] };

  constructor(private readonly outcome: RequestOutcome = { ok: true, message: "Done." }) {}

  async list(limit: number): Promise<readonly BackupRecord[]> {
    this.limits.list.push(limit);
    return [];
  }

  async drills(limit: number): Promise<readonly DrillRecord[]> {
    this.limits.drills.push(limit);
    return [];
  }

  async request(
    kind: "backup" | "drill" | "restore",
    backupId: number | undefined,
    timeoutMs: number,
  ): Promise<RequestOutcome> {
    this.asked.push({ kind, backupId, timeoutMs });
    return this.outcome;
  }

  async close(): Promise<void> {}
}

test("a backup that finished badly is an error, not an outcome to remember to check", async () => {
  const backups = new RecordingBackups({ ok: false, message: "No space left on device." });

  await expect(new ManageBackups({ backups }).run("backup")).rejects.toMatchObject({
    code: "backup.failed",
    message: "No space left on device.",
  });
});

test("a restore that finished badly says so under its own code", async () => {
  const backups = new RecordingBackups({ ok: false, message: "" });

  await expect(new ManageBackups({ backups }).restore(7)).rejects.toMatchObject({
    code: "backup.restore_failed",
    message: "That did not work.",
  });
});

/**
 * The CLI waited ten minutes and the studio five, so the same slow dump was
 * reported as failed in one and done in the other.
 */
test("every surface waits the same ten minutes for the service to answer", async () => {
  const backups = new RecordingBackups();
  const useCase = new ManageBackups({ backups });

  await useCase.run("drill");
  await useCase.restore();

  expect(backups.asked).toEqual([
    { kind: "drill", backupId: undefined, timeoutMs: 600_000 },
    { kind: "restore", backupId: undefined, timeoutMs: 600_000 },
  ]);
});

test("a restore names the backup it was given", async () => {
  const backups = new RecordingBackups();

  await new ManageBackups({ backups }).restore(12);

  expect(backups.asked[0]?.backupId).toBe(12);
});

test("what is listed is the same length wherever it was asked for", async () => {
  const backups = new RecordingBackups();
  const useCase = new ManageBackups({ backups });

  await useCase.list();
  await useCase.drills();
  await useCase.list(1);

  expect(backups.limits).toEqual({ list: [20, 1], drills: [20] });
});
