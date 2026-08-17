import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createStack, DomainError } from "#domain";
import {
  createOperator,
  type Operator,
  type OperatorTarget,
} from "#infrastructure";
import { ensureOperatorSecrets } from "./operator-http/write-env.ts";

export const OPERATOR_HTTP_PORT = 8788;

export function repoRootFromDelivery(deliveryDirname: string): string {
  return resolve(deliveryDirname, "../../..");
}

export function loadEnvFile(path: string, override: boolean): void {
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch {
    throw new DomainError(
      "cli.missing_env_file",
      "Copy operator.env.example to operator.env and run again.",
    );
  }
  applyEnvText(text, override);
}

export function applyEnvText(text: string, override: boolean): void {
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const eq = trimmed.indexOf("=");
    if (eq === -1) {
      continue;
    }
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (override || process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

export function parseTarget(raw: string): OperatorTarget {
  if (raw === "local" || raw === "hetzner") {
    return raw;
  }
  throw new DomainError("cli.invalid_target", "TARGET must be local or hetzner.");
}

export function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new DomainError("cli.missing_env", `Missing ${name} in operator.env.`);
  }
  return value;
}

export function assertHetznerKeys(target: OperatorTarget): void {
  if (target !== "hetzner") {
    return;
  }
  for (const name of [
    "HCLOUD_TOKEN",
    "HETZNER_DNS_TOKEN",
    "HETZNER_DNS_ZONE",
    "SSH_KEY_NAME",
  ]) {
    if (!process.env[name]) {
      throw new DomainError(
        "cli.missing_hetzner_key",
        `TARGET=hetzner is BYOK. Put your Hetzner ${name} in operator.env.`,
      );
    }
  }
}

export function assertHetznerConfig(target: OperatorTarget, hostname: string): void {
  if (target !== "hetzner") {
    return;
  }
  if (hostname === "localhost") {
    throw new DomainError(
      "cli.hetzner_localhost",
      "TARGET=hetzner needs a real hostname in stack/stack.json (not localhost).",
    );
  }
  const zone = process.env.HETZNER_DNS_ZONE ?? "";
  if (zone && hostname !== zone && !hostname.endsWith(`.${zone}`)) {
    throw new DomainError(
      "cli.hetzner_hostname_zone",
      `Hostname '${hostname}' must be under DNS zone '${zone}'.`,
    );
  }
  const siteAddress = process.env.SITE_ADDRESS ?? "";
  if (!siteAddress || siteAddress === ":8080" || siteAddress.startsWith(":")) {
    throw new DomainError(
      "cli.hetzner_site_address",
      `TARGET=hetzner needs SITE_ADDRESS=${hostname} in operator.env (Caddy TLS).`,
    );
  }
  if (siteAddress !== hostname) {
    throw new DomainError(
      "cli.hetzner_site_mismatch",
      `SITE_ADDRESS ('${siteAddress}') must match stack hostname ('${hostname}').`,
    );
  }
}

export function createOperatorFromRoot(root: string, overrideEnv = false): Operator {
  const envFile = resolve(root, "operator.env");
  ensureOperatorSecrets(root);
  loadEnvFile(envFile, overrideEnv);
  const stack = createStack(
    JSON.parse(readFileSync(resolve(root, "stack/stack.json"), "utf8")),
  );
  const target = parseTarget(process.env.TARGET ?? "local");
  assertHetznerKeys(target);
  assertHetznerConfig(target, stack.hostname);
  return createOperator({
    target,
    jwtSecret: requiredEnv("JWT_SECRET"),
    stack,
    stackDir: resolve(root, "stack"),
    envFile,
    statePath: resolve(root, ".baseplate/state.json"),
    infraDir: resolve(root, "infra"),
    hcloudToken: process.env.HCLOUD_TOKEN ?? "",
    hetznerDnsToken: process.env.HETZNER_DNS_TOKEN ?? "",
    hetznerDnsZone: process.env.HETZNER_DNS_ZONE ?? "",
    sshKeyName: process.env.SSH_KEY_NAME ?? "",
    serverLocation: process.env.SERVER_LOCATION ?? "nbg1",
  });
}
