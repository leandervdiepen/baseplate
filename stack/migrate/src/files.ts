import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const BREAKPOINT = "--> statement-breakpoint";

export type MigrationFile = {
  name: string;
  text: string;
};

export function checksum(text: string): string {
  return createHash("sha256").update(text).digest("hex").slice(0, 32);
}

/**
 * Plain `.sql` files in filename order.
 *
 * The only directory this is ever pointed at is `stack/platform/`, Baseplate's
 * own schema, which ships with the version. An operator's tables are not here
 * and never will be: they live in their database, and a schema change is a
 * transaction against it.
 */
export function readMigrations(dir: string): MigrationFile[] {
  return readdirSync(dir)
    .filter((name) => name.endsWith(".sql"))
    .sort()
    .map((name) => ({ name, text: readFileSync(resolve(dir, name), "utf8") }));
}

export function splitStatements(text: string): string[] {
  return text
    .split(BREAKPOINT)
    .map((chunk) => stripComments(chunk).trim())
    .filter((chunk) => chunk.length > 0);
}

function stripComments(chunk: string): string {
  return chunk
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("--"))
    .join("\n");
}
