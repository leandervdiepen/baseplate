import { spawn } from "node:child_process";
import type { DownOptions, LogOptions, RunningStack, StackRuntime } from "#application";
import type { Server } from "#domain";
import { InfraError } from "#shared";

const SSH_OPTS = [
  "-o",
  "StrictHostKeyChecking=accept-new",
  "-o",
  "BatchMode=yes",
  "-o",
  "ConnectTimeout=10",
];
const READY_TIMEOUT_MS = 180_000;
const READY_INTERVAL_MS = 2_000;
/**
 * The only env file that crosses the wire. It holds stack secrets and nothing
 * from the operator's cloud account.
 */
const STACK_ENV = "stack.env";

export type RemoteComposeConfig = {
  stackDir: string;
  envFile: string;
  remoteDir: string;
  projectName: string;
  sshUser: string;
};

export class RemoteComposeRuntime implements StackRuntime {
  private readonly config: RemoteComposeConfig;
  private readonly compose: string;

  constructor(config: RemoteComposeConfig) {
    this.config = config;
    this.compose = `docker compose --env-file ${STACK_ENV} --project-name ${config.projectName} -f compose.yaml -f compose.cloud.yaml`;
  }

  async up(server: Server): Promise<void> {
    const host = `${this.config.sshUser}@${server.ipv4}`;
    await this.waitUntilReady(host);
    await this.sync(host);
    await run("ssh", [
      ...SSH_OPTS,
      host,
      `cd ${this.config.remoteDir} && ${this.compose} up -d --build --force-recreate --wait --wait-timeout 180`,
    ]);
  }

  async migrate(server: Server | undefined): Promise<void> {
    if (!server) {
      throw new InfraError(
        "ssh.no_server",
        "No server in state. Provision before running migrations.",
      );
    }
    const host = `${this.config.sshUser}@${server.ipv4}`;
    await this.sync(host);
    await run("ssh", [
      ...SSH_OPTS,
      host,
      `cd ${this.config.remoteDir} && ${this.compose} run --rm --build migrate`,
    ]);
  }

  async down(server: Server | undefined, options: DownOptions): Promise<void> {
    if (!server) {
      return;
    }
    const host = `${this.config.sshUser}@${server.ipv4}`;
    await run("ssh", [
      ...SSH_OPTS,
      host,
      `cd ${this.config.remoteDir} && ${this.compose} down${options.volumes ? " -v" : ""}`,
    ]);
  }

  /** Over SSH, because the containers are on the server and not on this laptop. */
  async logs(server: Server | undefined, options: LogOptions): Promise<string> {
    if (!server) {
      throw new InfraError(
        "ssh.no_server",
        "This project targets Hetzner and has no server yet, so there is nothing to read.",
      );
    }
    return capture("ssh", [
      ...SSH_OPTS,
      `${this.config.sshUser}@${server.ipv4}`,
      `cd ${this.config.remoteDir} && ${this.compose} logs --tail ${String(options.tail)} --no-color`,
    ]);
  }

  /**
   * A remote stack has a server to itself and binds none of this machine's
   * ports, so there is nothing here for another project to collide with.
   */
  async runningStacks(): Promise<readonly RunningStack[]> {
    return [];
  }

  async stopProject(_projectName: string): Promise<void> {}

  async isHealthy(baseUrl: string): Promise<boolean> {
    try {
      const response = await fetch(baseUrl);
      return response.status === 200 || response.status === 401;
    } catch {
      return false;
    }
  }

  private async sync(host: string): Promise<void> {
    await run("ssh", [...SSH_OPTS, host, `mkdir -p ${this.config.remoteDir}`]);
    await run("rsync", [
      "-az",
      "--delete",
      "--exclude",
      STACK_ENV,
      "-e",
      `ssh ${SSH_OPTS.join(" ")}`,
      `${this.config.stackDir}/`,
      `${host}:${this.config.remoteDir}`,
    ]);
    await run("scp", [
      ...SSH_OPTS,
      this.config.envFile,
      `${host}:${this.config.remoteDir}/${STACK_ENV}`,
    ]);
  }

  private async waitUntilReady(host: string): Promise<void> {
    const deadline = Date.now() + READY_TIMEOUT_MS;
    while (Date.now() < deadline) {
      try {
        await run("ssh", [...SSH_OPTS, host, "docker compose version"]);
        return;
      } catch {
        await sleep(READY_INTERVAL_MS);
      }
    }
    throw new InfraError(
      "ssh.not_ready",
      `SSH or Docker on ${host} was not ready within ${READY_TIMEOUT_MS / 1000}s.`,
    );
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/** Like `run`, but the output is the answer rather than something to watch. */
function capture(command: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.on("error", (cause) => {
      reject(new InfraError("ssh.spawn", `Failed to run ${command}.`, cause));
    });
    child.on("exit", (code) => {
      if (code === 0) {
        resolve(stdout);
        return;
      }
      reject(
        new InfraError("ssh.failed", stderr.trim() || `${command} exited ${code ?? "null"}.`),
      );
    });
  });
}

function run(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit" });
    child.on("error", (cause) => {
      reject(new InfraError("ssh.spawn", `Failed to run ${command}.`, cause));
    });
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(
        new InfraError(
          "ssh.failed",
          `${command} exited ${code ?? "null"}.`,
        ),
      );
    });
  });
}
