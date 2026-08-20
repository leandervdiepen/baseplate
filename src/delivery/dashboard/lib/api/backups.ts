import { get, post } from "./http.ts";
import type { BackupState } from "./types.ts";

export const getBackups = (): Promise<BackupState> => get<BackupState>("/api/backups");

export const runBackupJob = (kind: "backup" | "drill"): Promise<BackupState> =>
  post<BackupState>("/api/backups", { kind });
