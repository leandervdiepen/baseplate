import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { DomainError } from "#domain";
import { CONFIG_FILE } from "../paths.ts";

let current: string;
/** The keys the project in hand put into `process.env`, so they can be taken back. */
let planted: string[] = [];

export function setCurrentProject(root: string): void {
  current = root;
  planted = keysIn(root);
}

export function currentProject(): string {
  return current;
}

/**
 * Point the studio at another project.
 *
 * The keys the previous project planted in `process.env` are pulled first.
 * Loading the next file on top would otherwise leave anything it does not
 * mention behind, and "does not mention" is exactly the case that matters: a
 * project with no Hetzner token would inherit the last one's.
 */
export function switchProject(root: string): void {
  const config = resolve(root, CONFIG_FILE);
  if (!existsSync(config)) {
    throw new DomainError(
      "project.not_found",
      `No ${CONFIG_FILE} in ${root}. Run \`baseplate init\` there first.`,
    );
  }
  for (const key of planted) {
    delete process.env[key];
  }
  setCurrentProject(root);
}

/** Every key a project's config names, whatever its value. */
function keysIn(root: string): string[] {
  let text: string;
  try {
    text = readFileSync(resolve(root, CONFIG_FILE), "utf8");
  } catch {
    return [];
  }
  const keys: string[] = [];
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const eq = trimmed.indexOf("=");
    if (eq > 0) {
      keys.push(trimmed.slice(0, eq).trim());
    }
  }
  return keys;
}
