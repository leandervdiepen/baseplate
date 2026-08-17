import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createStack } from "#domain";
import { FileStackStateStore } from "#infrastructure";
import { parseEnvMap } from "./env-file.ts";

export type OperatorStatus = {
  configured: boolean;
  target: string | null;
  hostname: string;
  siteAddress: string | null;
  dnsZone: string | null;
  sshKeyName: string | null;
  baseUrl: string | null;
  apiUp: boolean;
  secrets: {
    jwt: boolean;
    hcloud: boolean;
    dnsToken: boolean;
    dnsZone: boolean;
    sshKey: boolean;
  };
};

export async function readStatus(root: string): Promise<OperatorStatus> {
  const envPath = resolve(root, "operator.env");
  const stack = createStack(
    JSON.parse(readFileSync(resolve(root, "stack/stack.json"), "utf8")),
  );
  if (!existsSync(envPath)) {
    return {
      configured: false,
      target: null,
      hostname: stack.hostname,
      siteAddress: null,
      dnsZone: null,
      sshKeyName: null,
      baseUrl: null,
      apiUp: false,
      secrets: {
        jwt: false,
        hcloud: false,
        dnsToken: false,
        dnsZone: false,
        sshKey: false,
      },
    };
  }
  const env = parseEnvMap(readFileSync(envPath, "utf8"));
  const store = new FileStackStateStore(resolve(root, ".baseplate/state.json"));
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
  return {
    configured: Boolean(env.JWT_SECRET),
    target: env.TARGET ?? "local",
    hostname: stack.hostname,
    siteAddress: env.SITE_ADDRESS ?? null,
    dnsZone: env.HETZNER_DNS_ZONE ?? null,
    sshKeyName: env.SSH_KEY_NAME ?? null,
    baseUrl,
    apiUp,
    secrets: {
      jwt: Boolean(env.JWT_SECRET),
      hcloud: Boolean(env.HCLOUD_TOKEN),
      dnsToken: Boolean(env.HETZNER_DNS_TOKEN),
      dnsZone: Boolean(env.HETZNER_DNS_ZONE),
      sshKey: Boolean(env.SSH_KEY_NAME),
    },
  };
}
