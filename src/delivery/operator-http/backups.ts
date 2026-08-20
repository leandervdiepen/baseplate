import type { IncomingMessage, ServerResponse } from "node:http";
import { DomainError } from "#domain";
import { createOperatorFor, type OperatorRoots } from "../operator-setup.ts";
import { readJsonBody, sendJson } from "./json.ts";

/** Long enough for a real dump, short enough that the studio is not left hanging. */
const REQUEST_TIMEOUT_MS = 5 * 60_000;

export async function handleBackupRoute(
  roots: OperatorRoots,
  path: string,
  method: string,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  let operator;
  try {
    operator = createOperatorFor(roots, true);
  } catch {
    sendJson(res, 200, { live: false, backups: [], drills: [] });
    return;
  }

  try {
    if (path === "/api/backups" && method === "GET") {
      const [backups, drills] = await Promise.all([
        operator.backups.list(20),
        operator.backups.drills(10),
      ]);
      sendJson(res, 200, { live: true, backups, drills });
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
      const outcome = await operator.backups.request(body.kind, undefined, REQUEST_TIMEOUT_MS);
      if (!outcome.ok) {
        throw new DomainError("backup.failed", outcome.message || "That did not work.");
      }
      const [backups, drills] = await Promise.all([
        operator.backups.list(20),
        operator.backups.drills(10),
      ]);
      sendJson(res, 200, { live: true, backups, drills, message: outcome.message });
      return;
    }
    sendJson(res, 404, { code: "operator.not_found", message: "Unknown backup route." });
  } finally {
    await operator.backups.close();
    await operator.storage.close();
    await operator.admin.close();
  }
}
