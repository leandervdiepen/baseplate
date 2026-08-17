import { spawn } from "node:child_process";
import type { StackRuntime } from "#application";
import type { Server } from "#domain";
import { InfraError } from "#shared";

export type RemoteComposeConfig = {
  stackDir: string;
  envFile: string;
  remoteDir: string;
  sshUser: string;
};

export class RemoteComposeRuntime implements StackRuntime {
  constructor(private readonly config: RemoteComposeConfig) {}

  async up(server: Server): Promise<void> {
    const dest = `${this.config.sshUser}@${server.ipv4}:${this.config.remoteDir}`;
    await run("ssh", [
      `${this.config.sshUser}@${server.ipv4}`,
      `mkdir -p ${this.config.remoteDir}`,
    ]);
    await run("rsync", [
      "-az",
      "--delete",
      `${this.config.stackDir}/`,
      dest,
    ]);
    await run("scp", [
      this.config.envFile,
      `${this.config.sshUser}@${server.ipv4}:${this.config.remoteDir}/operator.env`,
    ]);
    await run("ssh", [
      `${this.config.sshUser}@${server.ipv4}`,
      `cd ${this.config.remoteDir} && docker compose --env-file operator.env --project-name baseplate -f compose.yaml -f compose.cloud.yaml up -d --wait`,
    ]);
  }

  async down(server: Server | undefined): Promise<void> {
    if (!server) {
      return;
    }
    await run("ssh", [
      `${this.config.sshUser}@${server.ipv4}`,
      `cd ${this.config.remoteDir} && docker compose --project-name baseplate down -v`,
    ]);
  }

  async isHealthy(baseUrl: string): Promise<boolean> {
    try {
      const response = await fetch(baseUrl);
      return response.status === 200 || response.status === 401;
    } catch {
      return false;
    }
  }
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
