import { createHash } from "node:crypto";
import { basename } from "node:path";

/**
 * Two Baseplate projects on one machine must not share Docker volumes. The
 * directory name keeps containers recognisable; the path hash keeps them apart,
 * so two directories both called "api" never adopt each other's database.
 */
export function composeProjectName(projectRoot: string): string {
  const label = basename(projectRoot).toLowerCase().replaceAll(/[^a-z0-9]+/g, "-");
  const trimmed = label.replace(/^-+|-+$/g, "").slice(0, 24) || "project";
  const digest = createHash("sha256").update(projectRoot).digest("hex").slice(0, 8);
  return `baseplate-${trimmed}-${digest}`;
}
