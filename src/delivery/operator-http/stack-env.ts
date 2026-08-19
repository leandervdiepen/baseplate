import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { parseEnvMap } from "./env-file.ts";

/**
 * Keys the running stack needs. Everything else in operator.env, including the
 * operator's Hetzner credentials, stays on this machine.
 */
export const STACK_ENV_KEYS = [
  "JWT_SECRET",
  "POSTGRES_PASSWORD",
  "AUTHENTICATOR_PASSWORD",
  "AUTH_SERVICE_PASSWORD",
  "HTTP_PORT",
  "POSTGRES_PORT",
  "SITE_ADDRESS",
  "ACCESS_TOKEN_TTL",
  "REFRESH_TOKEN_TTL",
] as const;

export function stackEnvText(operatorEnv: Record<string, string>): string {
  const lines = ["# Generated from operator.env. Cloud credentials never land here."];
  for (const key of STACK_ENV_KEYS) {
    const value = operatorEnv[key];
    if (value !== undefined && value !== "") {
      lines.push(`${key}=${value}`);
    }
  }
  return `${lines.join("\n")}\n`;
}

export function writeStackEnv(root: string): string {
  const target = resolve(root, ".baseplate/stack.env");
  const operatorEnv = parseEnvMap(readFileSync(resolve(root, "operator.env"), "utf8"));
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, stackEnvText(operatorEnv), { encoding: "utf8", mode: 0o600 });
  return target;
}
