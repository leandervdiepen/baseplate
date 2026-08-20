export type BackupRecord = {
  readonly id: number;
  readonly key: string;
  readonly bytes: number;
  readonly destination: string;
  readonly finishedAt: string | null;
  readonly ok: boolean;
  readonly message: string | null;
};

export type DrillRecord = {
  readonly id: number;
  readonly backupId: number | null;
  readonly ranAt: string;
  readonly ok: boolean;
  readonly tables: number;
  readonly rows: number;
  readonly durationMs: number;
  readonly message: string | null;
};

export type RequestOutcome = {
  readonly ok: boolean;
  readonly message: string;
};

/**
 * The backup service runs beside the database, wherever that is, so the
 * operator asks for work by writing a row rather than by reaching a port.
 * Nothing new is exposed and the same path works locally and on a server.
 */
export type BackupAdmin = {
  list(limit: number): Promise<readonly BackupRecord[]>;
  drills(limit: number): Promise<readonly DrillRecord[]>;
  /** Queues the work and waits for the service to report back. */
  request(
    kind: "backup" | "drill" | "restore",
    backupId: number | undefined,
    timeoutMs: number,
  ): Promise<RequestOutcome>;
  close(): Promise<void>;
};
