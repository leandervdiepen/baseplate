import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { DomainError } from "#domain";
import { parseEnvMap, upsertEnv } from "./env-file.ts";

export function secretValue(): string {
  return randomBytes(32).toString("base64url");
}

export function writeLocalFirstRun(root: string): void {
  const envPath = resolve(root, "operator.env");
  const example = readFileSync(resolve(root, "operator.env.example"), "utf8");
  const existing = existsSync(envPath) ? readFileSync(envPath, "utf8") : example;
  const current = parseEnvMap(existing);
  const jwt = current.JWT_SECRET && current.JWT_SECRET.length >= 32
    ? current.JWT_SECRET
    : secretValue();
  const next = upsertEnv(existing, {
    TARGET: "local",
    JWT_SECRET: jwt,
    POSTGRES_PASSWORD: current.POSTGRES_PASSWORD || secretValue(),
    AUTHENTICATOR_PASSWORD: current.AUTHENTICATOR_PASSWORD || secretValue(),
    AUTH_SERVICE_PASSWORD: current.AUTH_SERVICE_PASSWORD || secretValue(),
    HTTP_PORT: current.HTTP_PORT || "8080",
    SITE_ADDRESS: current.SITE_ADDRESS || ":8080",
  });
  writeFileSync(envPath, next, "utf8");
}

export function ensureOperatorSecrets(root: string): void {
  const envPath = resolve(root, "operator.env");
  if (!existsSync(envPath)) {
    return;
  }
  const existing = readFileSync(envPath, "utf8");
  const current = parseEnvMap(existing);
  const updates: Record<string, string> = {};
  if (!current.AUTH_SERVICE_PASSWORD) {
    updates.AUTH_SERVICE_PASSWORD = secretValue();
  }
  if (Object.keys(updates).length === 0) {
    return;
  }
  writeFileSync(envPath, upsertEnv(existing, updates), "utf8");
}

export function writeOperatorEnv(
  root: string,
  updates: Record<string, string>,
): void {
  const envPath = resolve(root, "operator.env");
  if (!existsSync(envPath)) {
    throw new DomainError(
      "cli.missing_env_file",
      "Run local first-run before saving Hetzner keys.",
    );
  }
  const next = upsertEnv(readFileSync(envPath, "utf8"), updates);
  writeFileSync(envPath, next, "utf8");
}
