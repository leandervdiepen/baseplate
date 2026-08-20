import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createStack, DomainError, type Stack } from "#domain";
import {
  createOperator,
  type Operator,
  type OperatorTarget,
} from "#infrastructure";
import { DEFAULT_ACCESS_TTL, parseTtl } from "../../stack/shared/ttl.ts";
import { ensureOperatorSecrets } from "./operator-http/write-env.ts";
import { writeStackEnv } from "./operator-http/stack-env.ts";
import { CONFIG_FILE, STATE_DIR } from "./paths.ts";
import { composeProjectName } from "./project-name.ts";

/** Where the studio listens when a project has not chosen for itself. */
export const OPERATOR_HTTP_PORT = 8788;

/**
 * The studio is per project, so its port is too. Two projects both serving the
 * studio on one port meant the second one died on EADDRINUSE.
 */
export function dashboardPortFor(root: string): number {
  try {
    const text = readFileSync(resolve(root, CONFIG_FILE), "utf8");
    const match = text.match(/^\s*DASHBOARD_PORT\s*=\s*(\d+)\s*$/m);
    const port = match?.[1] ? Number(match[1]) : Number.NaN;
    return Number.isInteger(port) && port > 0 && port < 65536 ? port : OPERATOR_HTTP_PORT;
  } catch {
    // No project here yet. The studio still comes up and offers first run.
    return OPERATOR_HTTP_PORT;
  }
}

export function loadEnvFile(path: string, override: boolean): void {
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch {
    throw new DomainError(
      "cli.missing_env_file",
      "No Baseplate project here. Run `baseplate init` first.",
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
    throw new DomainError("cli.missing_env", `Missing ${name} in ${CONFIG_FILE}.`);
  }
  return value;
}

/**
 * Where a recovery or confirmation link points. The app dev serves that page,
 * not Baseplate, so the default is where a dev server usually sits.
 */
export function siteUrlFromEnv(): string {
  return process.env.SITE_URL || "http://localhost:3000";
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
        `TARGET=hetzner is BYOK. Put your Hetzner ${name} in Settings.`,
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
      "TARGET=hetzner needs a hostname you own. Set it in Settings.",
    );
  }
  const zone = process.env.HETZNER_DNS_ZONE ?? "";
  if (zone && hostname !== zone && !hostname.endsWith(`.${zone}`)) {
    throw new DomainError(
      "cli.hetzner_hostname_zone",
      `Hostname '${hostname}' must be under DNS zone '${zone}'.`,
    );
  }
}

/**
 * Everything except the hostname is a Baseplate constant. The operator picks a
 * hostname; they do not maintain a stack file.
 */
export function stackFromEnv(): Stack {
  return createStack({
    name: "baseplate",
    hostname: process.env.HOSTNAME_OVERRIDE || process.env.BASEPLATE_HOSTNAME || "localhost",
    callerRole: "app_user",
    databaseName: "app",
  });
}

export type OperatorRoots = {
  /** Where Baseplate is installed. */
  packageRoot: string;
  /** The operator's own directory: config, secrets, state. */
  projectRoot: string;
};

export function createOperatorFor(roots: OperatorRoots, overrideEnv = false): Operator {
  const { packageRoot, projectRoot: project } = roots;
  ensureOperatorSecrets(project);
  loadEnvFile(resolve(project, CONFIG_FILE), overrideEnv);
  const stack = stackFromEnv();
  const target = parseTarget(process.env.TARGET ?? "local");
  assertHetznerKeys(target);
  assertHetznerConfig(target, stack.hostname);
  return createOperator({
    target,
    jwtSecret: requiredEnv("JWT_SECRET"),
    stack,
    stackDir: resolve(packageRoot, "stack"),
    projectName: composeProjectName(project),
    projectRoot: project,
    envFile: writeStackEnv(project),
    postgresPassword: requiredEnv("POSTGRES_PASSWORD"),
    postgresPort: Number(process.env.POSTGRES_PORT ?? "5432"),
    statePath: resolve(project, STATE_DIR, "state.json"),
    httpPort: Number(process.env.HTTP_PORT ?? "8080"),
    infraSourceDir: resolve(packageRoot, "infra"),
    infraWorkDir: resolve(project, STATE_DIR, "infra"),
    hcloudToken: process.env.HCLOUD_TOKEN ?? "",
    hetznerDnsToken: process.env.HETZNER_DNS_TOKEN ?? "",
    hetznerDnsZone: process.env.HETZNER_DNS_ZONE ?? "",
    sshKeyName: process.env.SSH_KEY_NAME ?? "",
    serverLocation: process.env.SERVER_LOCATION ?? "nbg1",
    // The same knob the auth service reads, parsed by the same function, so a
    // minted token lasts exactly as long as a signed-in one.
    accessTtlSeconds: parseTtl(process.env.ACCESS_TOKEN_TTL ?? "", DEFAULT_ACCESS_TTL),
  });
}
