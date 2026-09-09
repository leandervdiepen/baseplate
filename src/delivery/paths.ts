import { resolve } from "node:path";

/**
 * Two roots. The package root is Baseplate itself - compose files, platform
 * migrations, the studio - read-only to an operator and replaced by an upgrade.
 * The project root is theirs: config, secrets, state, and nothing Baseplate ships.
 */
export function packageRootFrom(deliveryDirname: string): string {
  return resolve(deliveryDirname, "../../..");
}

export function projectRoot(): string {
  return process.env.BASEPLATE_PROJECT ?? process.cwd();
}

export const CONFIG_FILE = "baseplate.env";
export const STATE_DIR = ".baseplate";

export function stackStateFile(target: "local" | "hetzner"): string {
  return `state.${target}.json`;
}
