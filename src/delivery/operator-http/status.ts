import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { FileStackStateStore } from "#infrastructure";
import { parseEnvMap } from "./env-file.ts";
import { basename } from "node:path";
import { CONFIG_FILE, STATE_DIR, stackStateFile } from "../paths.ts";
import { readReadiness, type ReadinessCheck } from "./readiness.ts";

export type OperatorStatus = {
  configured: boolean;
  /** Which project this studio is serving. One studio, one project. */
  project: { name: string; path: string };
  target: string | null;
  hostname: string;
  siteAddress: string | null;
  dnsZone: string | null;
  sshKeyName: string | null;
  serverLocation: string | null;
  accessTokenTtl: string;
  refreshTokenTtl: string;
  readiness: ReadinessCheck[];
  baseUrl: string | null;
  apiUp: boolean;
  secrets: {
    jwt: boolean;
    hcloud: boolean;
    dnsZone: boolean;
    sshKey: boolean;
  };
};

export async function readStatus(root: string): Promise<OperatorStatus> {
  const envPath = resolve(root, CONFIG_FILE);
  if (!existsSync(envPath)) {
    return {
      configured: false,
      project: projectLabel(root),
      target: null,
      hostname: "localhost",
      siteAddress: null,
      dnsZone: null,
      sshKeyName: null,
      serverLocation: null,
      accessTokenTtl: "1h",
      refreshTokenTtl: "30d",
      readiness: [],
      baseUrl: null,
      apiUp: false,
      secrets: {
        jwt: false,
        hcloud: false,
        dnsZone: false,
        sshKey: false,
      },
    };
  }
  const env = parseEnvMap(readFileSync(envPath, "utf8"));
  const hostname = env.BASEPLATE_HOSTNAME || "localhost";
  const target = env.TARGET === "hetzner" ? "hetzner" : "local";
  const store = new FileStackStateStore(resolve(root, STATE_DIR, stackStateFile(target)));
  const record = await store.load();
  const baseUrl = record?.baseUrl ?? null;
  let apiUp = false;
  if (baseUrl) {
    try {
      const response = await fetch(baseUrl);
      apiUp = response.status === 200 || response.status === 401;
    } catch {
      apiUp = false;
    }
  }
  const secrets = {
    jwt: Boolean(env.JWT_SECRET),
    hcloud: Boolean(env.HCLOUD_TOKEN),
    dnsZone: Boolean(env.HETZNER_DNS_ZONE),
    sshKey: Boolean(env.SSH_KEY_NAME),
  };
  return {
    configured: Boolean(env.JWT_SECRET),
    project: projectLabel(root),
    target,
    hostname,
    siteAddress: env.SITE_ADDRESS ?? null,
    dnsZone: env.HETZNER_DNS_ZONE ?? null,
    sshKeyName: env.SSH_KEY_NAME ?? null,
    serverLocation: env.SERVER_LOCATION ?? "nbg1",
    accessTokenTtl: env.ACCESS_TOKEN_TTL || "1h",
    refreshTokenTtl: env.REFRESH_TOKEN_TTL || "30d",
    readiness: readReadiness({
      target,
      hostname,
      siteAddress: env.SITE_ADDRESS ?? null,
      dnsZone: env.HETZNER_DNS_ZONE ?? null,
      secrets,
    }),
    baseUrl,
    apiUp,
    secrets,
  };
}

/** The directory is the project's name. Two studios are told apart by it. */
function projectLabel(root: string): { name: string; path: string } {
  return { name: basename(root) || root, path: root };
}
