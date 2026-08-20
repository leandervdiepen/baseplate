import { useEffect, useState } from "react";
import { getBackups, runBackupJob, type BackupState } from "../lib/api/index.ts";

/**
 * Every backup this project has taken and every drill that has restored one,
 * plus the two jobs that add to those lists. A job answers with the whole state
 * again, so the page never has to guess what changed.
 */
export function useBackups() {
  const [state, setState] = useState<BackupState | null>(null);
  const [busy, setBusy] = useState<"backup" | "drill" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void getBackups()
      .then(setState)
      .catch((cause: unknown) => {
        setError(cause instanceof Error ? cause.message : "Unable to read your backups.");
        setState({ live: false, backups: [], drills: [] });
      });
  }, []);

  return {
    state,
    busy,
    message,
    error,

    async run(kind: "backup" | "drill"): Promise<void> {
      setBusy(kind);
      setError(null);
      setMessage(null);
      try {
        const next = await runBackupJob(kind);
        setState(next);
        setMessage(next.message ?? "Done.");
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "That did not work.");
      } finally {
        setBusy(null);
      }
    },
  };
}
