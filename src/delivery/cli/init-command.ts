import { spawnSync } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { DomainError } from "#domain";
import { CONFIG_FILE, STATE_DIR } from "../paths.ts";
import { composeProjectName } from "../project-name.ts";
import { makeSecretDir, writeSecretFile } from "../operator-http/env-file.ts";
import { TEMPLATE } from "../operator-http/write-env.ts";
import { secretValue } from "../operator-http/write-env.ts";

/**
 * A project keeps its database in a Docker volume named after its path. New
 * secrets against an old volume fail as "password authentication failed", which
 * says nothing useful, so catch it here where the fix is obvious.
 */
function assertNoOrphanedData(project: string): void {
  const name = composeProjectName(project);
  const result = spawnSync("docker", ["volume", "ls", "--quiet"], {
    encoding: "utf8",
    timeout: 5_000,
  });
  if (result.status !== 0 || !result.stdout) {
    return;
  }
  // Only the database matters. Caddy's volume holds certificates it can refetch.
  const database = `${name}_pgdata`;
  if (!result.stdout.split("\n").includes(database)) {
    return;
  }
  throw new DomainError(
    "cli.orphaned_data",
    `A database from an earlier Baseplate project in this directory is still here. New secrets cannot open it. Run \`docker volume rm ${database}\` to start fresh, or restore the baseplate.env that made it.`,
  );
}

/** The ports a developer may name, rather than accept whatever was free. */
export type PortChoice = {
  http?: number | undefined;
  postgres?: number | undefined;
  dashboard?: number | undefined;
};

export function portValue(raw: string | undefined, flag: string): number | undefined {
  if (raw === undefined) {
    return undefined;
  }
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1 || value > 65535) {
    throw new DomainError(
      "cli.invalid_port",
      `${flag} wants a port between 1 and 65535, got '${raw}'.`,
    );
  }
  return value;
}

/**
 * Creates the operator's project: a config file with freshly generated secrets
 * and a place to keep state. Nothing else, and nothing they have to maintain.
 *
 * Ports are the same well-known numbers in every project, because only one
 * stack runs at a time. Probing for a free one used to look considerate and was
 * not: two projects created before either started still picked the same port,
 * and the operator had no idea which project had which until something failed
 * to bind.
 */
export function initProject(project: string, ports: PortChoice = {}): string {
  const configPath = resolve(project, CONFIG_FILE);
  if (existsSync(configPath)) {
    throw new DomainError(
      "cli.already_initialised",
      `${CONFIG_FILE} is already here. Run \`baseplate up\` to start it.`,
    );
  }
  assertNoOrphanedData(project);
  makeSecretDir(resolve(project, STATE_DIR));
  const httpPort = ports.http ?? 8080;
  const postgresPort = ports.postgres ?? 5432;
  const dashboardPort = ports.dashboard ?? 8788;
  // SITE_ADDRESS is what Caddy listens on inside the container and stays 8080.
  // HTTP_PORT is only the host mapping.
  const config = TEMPLATE.replace("HTTP_PORT=8080", `HTTP_PORT=${httpPort}`)
    .replace("POSTGRES_PORT=5432", `POSTGRES_PORT=${postgresPort}`)
    .replace("DASHBOARD_PORT=8788", `DASHBOARD_PORT=${dashboardPort}`)
    .replace(
    "TARGET=local",
    [
      "TARGET=local",
      "",
      `JWT_SECRET=${secretValue()}`,
      `POSTGRES_PASSWORD=${secretValue()}`,
      `AUTHENTICATOR_PASSWORD=${secretValue()}`,
      `AUTH_SERVICE_PASSWORD=${secretValue()}`,
    ].join("\n"),
  );
  writeSecretFile(configPath, config);
  writeFileSync(
    resolve(project, STATE_DIR, ".gitignore"),
    "*\n",
    "utf8",
  );
  return configPath;
}
