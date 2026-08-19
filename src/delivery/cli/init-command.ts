import { spawnSync } from "node:child_process";
import { createConnection, createServer } from "node:net";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { DomainError } from "#domain";
import { CONFIG_FILE, STATE_DIR } from "../paths.ts";
import { composeProjectName } from "../project-name.ts";
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

export async function freePortFrom(start: number): Promise<number> {
  for (let port = start; port < start + 50; port += 1) {
    if (await isFree(port)) {
      return port;
    }
  }
  return start;
}

/**
 * Asks two questions, because one is not enough. Compose publishes some ports on
 * the wildcard address and others on loopback, and a bind probe on the wrong one
 * reports free when it is not. Connecting catches anything already listening;
 * the bind catches anything holding the port without accepting.
 */
async function isFree(port: number): Promise<boolean> {
  if (await accepts(port)) {
    return false;
  }
  return canBind(port);
}

function accepts(port: number): Promise<boolean> {
  return new Promise((resolvePromise) => {
    const socket = createConnection({ port, host: "127.0.0.1" });
    const settle = (listening: boolean) => {
      socket.destroy();
      resolvePromise(listening);
    };
    socket.setTimeout(300);
    socket.once("connect", () => settle(true));
    socket.once("timeout", () => settle(false));
    socket.once("error", () => settle(false));
  });
}

function canBind(port: number): Promise<boolean> {
  return new Promise((resolvePromise) => {
    const probe = createServer();
    probe.once("error", () => resolvePromise(false));
    probe.once("listening", () => {
      probe.close(() => resolvePromise(true));
    });
    probe.listen(port);
  });
}

/**
 * Creates the operator's project: a config file with freshly generated secrets
 * and a place to keep state. Nothing else, and nothing they have to maintain.
 *
 * Ports are chosen from what is free, so a second project on this machine comes
 * up instead of failing to bind.
 */
export async function initProject(project: string): Promise<string> {
  const configPath = resolve(project, CONFIG_FILE);
  if (existsSync(configPath)) {
    throw new DomainError(
      "cli.already_initialised",
      `${CONFIG_FILE} is already here. Run \`baseplate up\` to start it.`,
    );
  }
  assertNoOrphanedData(project);
  mkdirSync(resolve(project, STATE_DIR), { recursive: true });
  const httpPort = await freePortFrom(8080);
  const postgresPort = await freePortFrom(5432);
  const dashboardPort = await freePortFrom(8788);
  // SITE_ADDRESS is what Caddy listens on inside the container and stays 8080.
  // HTTP_PORT is only the host mapping, which is what has to dodge a collision.
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
  writeFileSync(configPath, config, { encoding: "utf8", mode: 0o600 });
  writeFileSync(
    resolve(project, STATE_DIR, ".gitignore"),
    "*\n",
    "utf8",
  );
  return configPath;
}
