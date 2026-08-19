import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { parseEnvMap } from "./env-file.ts";
import { CONFIG_FILE, STATE_DIR } from "../paths.ts";

/**
 * Keys the running stack needs. Everything else in the project's config,
 * including the operator's Hetzner credentials, stays on this machine.
 */
export const STACK_ENV_KEYS = [
  "JWT_SECRET",
  "POSTGRES_PASSWORD",
  "AUTHENTICATOR_PASSWORD",
  "AUTH_SERVICE_PASSWORD",
  "HTTP_PORT",
  "POSTGRES_PORT",
  "SITE_ADDRESS",
  "CORS_ORIGIN",
  "ACCESS_TOKEN_TTL",
  "REFRESH_TOKEN_TTL",
] as const;

export function stackEnvText(operatorEnv: Record<string, string>): string {
  const lines = [`# Generated from ${CONFIG_FILE}. Cloud credentials never land here.`];
  for (const key of STACK_ENV_KEYS) {
    const value = operatorEnv[key];
    if (value !== undefined && value !== "") {
      lines.push(`${key}=${value}`);
    }
  }
  return `${lines.join("\n")}\n`;
}

/** Written into the operator's own directory, never into the package. */
export function writeStackEnv(root: string): string {
  const target = resolve(root, STATE_DIR, "stack.env");
  const operatorEnv = parseEnvMap(readFileSync(resolve(root, CONFIG_FILE), "utf8"));
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, stackEnvText(operatorEnv), { encoding: "utf8", mode: 0o600 });
  return target;
}
