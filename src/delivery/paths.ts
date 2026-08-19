import { resolve } from "node:path";

/**
 * Two roots, deliberately separate.
 *
 * The package root is where Baseplate itself lives: compose files, platform
 * migrations, the dashboard. It is read-only as far as an operator is concerned
 * and it moves when they upgrade the version.
 *
 * The project root is the operator's own directory: their config, their
 * secrets, their state. Nothing Baseplate ships is written there.
 */
export function packageRootFrom(deliveryDirname: string): string {
  return resolve(deliveryDirname, "../../..");
}

export function projectRoot(): string {
  return process.env.BASEPLATE_PROJECT ?? process.cwd();
}

export const CONFIG_FILE = "baseplate.env";
export const STATE_DIR = ".baseplate";
