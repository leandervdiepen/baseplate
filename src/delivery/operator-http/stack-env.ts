import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { makeSecretDir, parseEnvMap, writeSecretFile } from "./env-file.ts";
import { CONFIG_FILE, STATE_DIR } from "../paths.ts";

/**
 * Keys the running stack needs. Everything else in the project's config,
 * including the operator's Hetzner credentials, stays on this machine.
 *
 * BACKUP_KEY and the BACKUP_S3_* credentials do cross, deliberately: the backup
 * and its restore drill run where the database is. They are one bucket's worth
 * of access, not an account that can create and destroy servers.
 */
export const STACK_ENV_KEYS = [
  "JWT_SECRET",
  "POSTGRES_PASSWORD",
  "AUTHENTICATOR_PASSWORD",
  "AUTH_SERVICE_PASSWORD",
  "STORAGE_SERVICE_PASSWORD",
  "STORAGE_ACCESS_KEY",
  "STORAGE_SECRET_KEY",
  "STORAGE_ENDPOINT",
  "STORAGE_BUCKET",
  "STORAGE_REGION",
  "STORAGE_MAX_BYTES",
  "BACKUP_KEY",
  "BACKUP_EVERY",
  "DRILL_EVERY",
  "BACKUP_KEEP",
  "BACKUP_S3_ENDPOINT",
  "BACKUP_S3_BUCKET",
  "BACKUP_S3_REGION",
  "BACKUP_S3_ACCESS_KEY",
  "BACKUP_S3_SECRET_KEY",
  "HTTP_PORT",
  "POSTGRES_PORT",
  "SITE_ADDRESS",
  "CORS_ORIGIN",
  "ACCESS_TOKEN_TTL",
  "REFRESH_TOKEN_TTL",
  "SITE_URL",
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_USER",
  "SMTP_PASS",
  "SMTP_FROM",
  "SMTP_SECURE",
  "MAILPIT_UI_PORT",
  "REQUIRE_EMAIL_CONFIRM",
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
  makeSecretDir(dirname(target));
  writeSecretFile(target, stackEnvText(operatorEnv));
  return target;
}
