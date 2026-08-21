import type { IncomingMessage, ServerResponse } from "node:http";
import type { BackupRecord, DrillRecord, ManageBackups } from "#application";
import { DomainError } from "#domain";
import { createOperatorFor, type OperatorRoots } from "../operator-setup.ts";
import { readJsonBody, sendJson } from "./json.ts";

export async function handleBackupRoute(
  roots: OperatorRoots,
  path: string,
  method: string,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  let operator;
  try {
    operator = await createOperatorFor(roots, true);
  } catch {
    sendJson(res, 200, { live: false, backups: [], drills: [] });
    return;
  }
  const backups = operator.backups;

  try {
    if (path === "/api/backups" && method === "GET") {
      sendJson(res, 200, { live: true, ...(await history(backups)) });
      return;
    }
    if (path === "/api/backups" && method === "POST") {
      const body = (await readJsonBody(req)) as { kind?: string };
      // Restore is destructive and belongs on the CLI, where it can ask for the
      // project's name to be typed. The studio takes backups and runs drills.
      if (body.kind !== "backup" && body.kind !== "drill") {
        throw new DomainError(
          "backup.unsupported",
          "The studio takes backups and runs drills. Restoring is `baseplate restore`.",
        );
      }
      const outcome = await backups.run(body.kind);
      sendJson(res, 200, { live: true, ...(await history(backups)), message: outcome.message });
      return;
    }
    sendJson(res, 404, { code: "operator.not_found", message: "Unknown backup route." });
  } finally {
    await operator.close();
  }
}

type History = {
  readonly backups: readonly BackupRecord[];
  readonly drills: readonly DrillRecord[];
};

/** Both lists come back with every answer, so the studio never shows a stale one. */
async function history(backups: ManageBackups): Promise<History> {
  const [taken, drills] = await Promise.all([backups.list(), backups.drills()]);
  return { backups: taken, drills };
}
