import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { InfraError } from "#shared";
import { writeStackEnv } from "./stack-env.ts";

export function readComposeLogs(root: string): Promise<string> {
  const args = [
    "compose",
    "--env-file",
    writeStackEnv(root),
    "--project-name",
    "baseplate",
    "-f",
    "compose.yaml",
    "logs",
    "--tail",
    "80",
    "--no-color",
  ];
  return new Promise((resolvePromise, reject) => {
    const child = spawn("docker", args, { cwd: resolve(root, "stack") });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on("error", (cause) => {
      reject(new InfraError("docker.spawn", "Failed to read compose logs.", cause));
    });
    child.on("exit", (code) => {
      if (code === 0) {
        resolvePromise(stdout);
        return;
      }
      reject(
        new InfraError(
          "docker.failed",
          stderr.trim() || `docker compose logs exited ${code ?? "null"}.`,
        ),
      );
    });
  });
}
