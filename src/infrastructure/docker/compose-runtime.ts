import { spawn } from "node:child_process";
import type { StackRuntime } from "#application";
import type { Server } from "#domain";
import { InfraError } from "#shared";

export type DockerComposeRuntimeConfig = {
  stackDir: string;
  envFile: string;
  projectName: string;
};

export class DockerComposeRuntime implements StackRuntime {
  constructor(private readonly config: DockerComposeRuntimeConfig) {}

  async up(_server: Server): Promise<void> {
    await runDocker(this.config, [
      "up",
      "-d",
      "--build",
      "--force-recreate",
      "--wait",
      "--wait-timeout",
      "180",
    ]);
  }

  async down(_server: Server | undefined): Promise<void> {
    await runDocker(this.config, ["down", "-v"]);
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

function runDocker(
  config: DockerComposeRuntimeConfig,
  subcommand: string[],
): Promise<void> {
  const args = [
    "compose",
    "--env-file",
    config.envFile,
    "--project-name",
    config.projectName,
    "-f",
    "compose.yaml",
    ...subcommand,
  ];
  return new Promise((resolve, reject) => {
    const child = spawn("docker", args, {
      cwd: config.stackDir,
      stdio: "inherit",
    });
    child.on("error", (cause) => {
      reject(new InfraError("docker.spawn", "Failed to run docker compose.", cause));
    });
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(
        new InfraError(
          "docker.failed",
          `docker compose ${subcommand.join(" ")} exited ${code ?? "null"}.`,
        ),
      );
    });
  });
}
