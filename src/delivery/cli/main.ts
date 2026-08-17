import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { createStack, DomainError } from "#domain";
import { createOperator, type OperatorTarget } from "#infrastructure";
import { InfraError } from "#shared";

const ROOT = resolve(import.meta.dirname, "../../..");

async function main(): Promise<void> {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: {
      sub: { type: "string" },
    },
  });
  const command = positionals[0];
  if (!command) {
    printUsage();
    process.exit(1);
  }

  loadEnv(resolve(ROOT, "operator.env"));
  const stack = createStack(
    JSON.parse(readFileSync(resolve(ROOT, "stack/stack.json"), "utf8")),
  );
  const target = parseTarget(process.env.TARGET ?? "local");
  assertHetznerKeys(target);
  const operator = createOperator({
    target,
    jwtSecret: required("JWT_SECRET"),
    stack,
    stackDir: resolve(ROOT, "stack"),
    envFile: resolve(ROOT, "operator.env"),
    statePath: resolve(ROOT, ".baseplate/state.json"),
    infraDir: resolve(ROOT, "infra"),
    hcloudToken: process.env.HCLOUD_TOKEN ?? "",
    hetznerDnsToken: process.env.HETZNER_DNS_TOKEN ?? "",
    hetznerDnsZone: process.env.HETZNER_DNS_ZONE ?? "",
    sshKeyName: process.env.SSH_KEY_NAME ?? "",
    serverLocation: process.env.SERVER_LOCATION ?? "nbg1",
  });

  if (command === "provision") {
    const result = await operator.provision.execute(stack);
    console.log(`${result.baseUrl}`);
    return;
  }
  if (command === "teardown") {
    await operator.teardown.execute();
    return;
  }
  if (command === "mint-token") {
    if (!values.sub) {
      throw new DomainError("cli.sub_required", "mint-token requires --sub <uuid>.");
    }
    const token = await operator.mintToken.execute(values.sub);
    console.log(token);
    return;
  }

  printUsage();
  process.exit(1);
}

function printUsage(): void {
  console.error("Usage: baseplate <provision|teardown|mint-token --sub UUID>");
}

function parseTarget(raw: string): OperatorTarget {
  if (raw === "local" || raw === "hetzner") {
    return raw;
  }
  throw new DomainError(
    "cli.invalid_target",
    "TARGET must be local or hetzner.",
  );
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new DomainError("cli.missing_env", `Missing ${name} in operator.env.`);
  }
  return value;
}

function assertHetznerKeys(target: OperatorTarget): void {
  if (target !== "hetzner") {
    return;
  }
  for (const name of ["HCLOUD_TOKEN", "HETZNER_DNS_TOKEN", "HETZNER_DNS_ZONE", "SSH_KEY_NAME"]) {
    if (!process.env[name]) {
      throw new DomainError(
        "cli.missing_hetzner_key",
        `TARGET=hetzner is BYOK. Put your Hetzner ${name} in operator.env.`,
      );
    }
  }
}

function loadEnv(path: string): void {
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch {
    throw new DomainError(
      "cli.missing_env_file",
      "Copy operator.env.example to operator.env and run again.",
    );
  }
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
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

main().catch((error: unknown) => {
  if (error instanceof DomainError || error instanceof InfraError) {
    console.error(`${error.code}: ${error.message}`);
    process.exit(1);
  }
  console.error(error);
  process.exit(1);
});
