import { spawn } from "node:child_process";
import type { DownOptions, RunningStack, StackRuntime } from "#application";
import type { Server } from "#domain";
import { InfraError } from "#shared";

export type DockerComposeRuntimeConfig = {
  stackDir: string;
  envFile: string;
  projectName: string;
  /** Stamped onto the containers, so another project can be named, not guessed. */
  projectRoot: string;
};

/** Compose stamps these on every container it starts for a Baseplate project. */
const ROOT_LABEL = "baseplate.project-root";
const PORT_LABEL = "baseplate.http-port";

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

  async down(_server: Server | undefined, options: DownOptions): Promise<void> {
    await runDocker(this.config, options.volumes ? ["down", "-v"] : ["down"]);
  }

  async migrate(_server: Server | undefined): Promise<void> {
    await runDocker(this.config, ["run", "--rm", "--build", "migrate"]);
  }

  async isHealthy(baseUrl: string): Promise<boolean> {
    try {
      const response = await fetch(baseUrl);
      return response.status === 200 || response.status === 401;
    } catch {
      return false;
    }
  }

  /**
   * Docker is the registry. Nothing is written outside the two roots to keep
   * track of which projects exist, so the running containers are asked instead.
   */
  async runningStacks(): Promise<readonly RunningStack[]> {
    return parseRunningStacks(
      await capture("docker", [
        "ps",
        "--filter",
        `label=${ROOT_LABEL}`,
        "--format",
        `{{.Label "com.docker.compose.project"}}\t{{.Label "${ROOT_LABEL}"}}\t{{.Label "${PORT_LABEL}"}}`,
      ]),
    );
  }

  /**
   * By container id rather than `compose stop`, because stopping someone else's
   * project would otherwise mean interpolating their env file into ours.
   */
  async stopProject(projectName: string): Promise<void> {
    const ids = (
      await capture("docker", [
        "ps",
        "--quiet",
        "--filter",
        `label=com.docker.compose.project=${projectName}`,
      ])
    )
      .split("\n")
      .filter((id) => id.length > 0);
    if (ids.length === 0) {
      return;
    }
    await capture("docker", ["stop", ...ids]);
  }
}

/**
 * One line per container, so a four-container stack answers four times. The
 * compose project name is what makes them one stack again.
 */
export function parseRunningStacks(output: string): readonly RunningStack[] {
  const found = new Map<string, RunningStack>();
  for (const line of output.split("\n")) {
    const [projectName, projectRoot, port] = line.split("\t");
    if (projectName && projectRoot && !found.has(projectName)) {
      found.set(projectName, {
        projectName,
        projectRoot,
        baseUrl: port ? `http://127.0.0.1:${port}` : "",
      });
    }
  }
  return [...found.values()];
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
      env: { ...process.env, BASEPLATE_PROJECT_ROOT: config.projectRoot },
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

/**
 * Docker not being installed is not an error here: it means no Baseplate stack
 * is running, which is exactly what an empty answer says.
 */
function capture(command: string, args: string[]): Promise<string> {
  return new Promise((resolve) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "ignore"] });
    let output = "";
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      output += chunk;
    });
    child.on("error", () => resolve(""));
    child.on("close", (code) => resolve(code === 0 ? output.trim() : ""));
  });
}
