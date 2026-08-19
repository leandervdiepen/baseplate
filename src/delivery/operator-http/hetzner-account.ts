import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { CloudAccountSnapshot } from "#application";
import { HetznerAccount } from "#infrastructure";
import { parseEnvMap } from "./env-file.ts";
import { CONFIG_FILE } from "../paths.ts";

/**
 * Reads the operator's own account with the tokens already on this machine.
 * The tokens are never sent to the browser; only what they can see is.
 */
export async function inspectAccount(root: string): Promise<CloudAccountSnapshot> {
  const envPath = resolve(root, CONFIG_FILE);
  const env = existsSync(envPath) ? parseEnvMap(readFileSync(envPath, "utf8")) : {};
  const account = new HetznerAccount({
    token: env.HCLOUD_TOKEN ?? "",
    dnsToken: env.HETZNER_DNS_TOKEN ?? "",
  });
  return account.inspect();
}
