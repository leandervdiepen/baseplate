import { spawn } from "node:child_process";
import { cpSync, mkdirSync } from "node:fs";
import { createServer, type Server, type Stack } from "#domain";
import type { CloudProvider } from "#application";
import { InfraError } from "#shared";

export type HetznerCloudConfig = {
  /** The Terraform that ships with this version of Baseplate. Read-only. */
  sourceDir: string;
  /** This project's own copy, where state and providers live. */
  workDir: string;
  token: string;
  dnsToken: string;
  dnsZone: string;
  sshKeyName: string;
  location: string;
  stackName: string;
  hostname: string;
};

export class HetznerCloudProvider implements CloudProvider {
  constructor(private readonly config: HetznerCloudConfig) {}

  async createServer(_stack: Stack): Promise<Server> {
    this.prepareWorkDir();
    await this.terraform(["init", "-input=false"]);
    await this.terraform(["apply", "-auto-approve", "-input=false", ...this.tfVars()]);
    const outputs = await this.outputs();
    return createServer(outputs.server_id, outputs.ipv4, "running");
  }

  async ensureFirewall(_server: Server): Promise<void> {}

  async ensureDns(_stack: Stack, _server: Server): Promise<void> {}

  async destroyServer(_serverId: string): Promise<void> {
    // `init` first, because a project can be restored from a backup or opened
    // on another machine with its state present and no providers downloaded.
    // Without this, destroy fails and the operator keeps paying for a server.
    this.prepareWorkDir();
    await this.terraform(["init", "-input=false"]);
    await this.terraform(["destroy", "-auto-approve", "-input=false", ...this.tfVars()]);
  }

  /**
   * Terraform writes state, a lock file, and a few hundred megabytes of
   * providers next to the configuration it is given. That configuration ships
   * with Baseplate, so running there put one mutable directory behind every
   * project on the machine and inside a directory that an upgrade replaces:
   * two projects would fight over one state file, and installing a new version
   * could lose the record of a running server.
   *
   * So the configuration is copied into the project on every run and Terraform
   * works there. The copy overwrites the `.tf` files, which is how an upgrade
   * reaches an existing project, and leaves everything Terraform itself wrote.
   */
  private prepareWorkDir(): void {
    syncTerraformDir(this.config.sourceDir, this.config.workDir);
  }

  private tfVars(): string[] {
    return [
      `-var=stack_name=${this.config.stackName}`,
      `-var=hostname=${this.config.hostname}`,
      `-var=location=${this.config.location}`,
      `-var=ssh_key_name=${this.config.sshKeyName}`,
      `-var=dns_zone=${this.config.dnsZone}`,
      `-var=dns_token=${this.config.dnsToken}`,
    ];
  }

  private terraform(args: string[]): Promise<void> {
    const env = {
      ...process.env,
      HCLOUD_TOKEN: this.config.token,
      HETZNER_DNS_TOKEN: this.config.dnsToken,
    };
    return run("terraform", args, this.config.workDir, env);
  }

  private async outputs(): Promise<{ server_id: string; ipv4: string }> {
    const raw = await capture(
      "terraform",
      ["output", "-json"],
      this.config.workDir,
      {
        ...process.env,
        HCLOUD_TOKEN: this.config.token,
      },
    );
    const parsed = JSON.parse(raw) as {
      server_id: { value: string };
      ipv4: { value: string };
    };
    return { server_id: parsed.server_id.value, ipv4: parsed.ipv4.value };
  }
}

/**
 * Copy the shipped configuration over whatever is in the project, and touch
 * nothing else. State, the lock file and the providers were written by
 * Terraform and are the project's; the `.tf` files are Baseplate's and are
 * replaced, which is how an upgrade reaches a project that already exists.
 */
export function syncTerraformDir(sourceDir: string, workDir: string): void {
  mkdirSync(workDir, { recursive: true });
  cpSync(sourceDir, workDir, { recursive: true });
}

function run(
  command: string,
  args: string[],
  cwd: string,
  env: NodeJS.ProcessEnv,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, env, stdio: "inherit" });
    child.on("error", (cause) => {
      reject(new InfraError("terraform.spawn", "Failed to run terraform.", cause));
    });
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(
        new InfraError(
          "terraform.failed",
          `${command} ${args[0]} exited ${code ?? "null"}.`,
        ),
      );
    });
  });
}

function capture(
  command: string,
  args: string[],
  cwd: string,
  env: NodeJS.ProcessEnv,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, env });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on("error", (cause) => {
      reject(new InfraError("terraform.spawn", "Failed to run terraform.", cause));
    });
    child.on("exit", (code) => {
      if (code === 0) {
        resolve(stdout);
        return;
      }
      reject(
        new InfraError(
          "terraform.failed",
          `${command} ${args.join(" ")} exited ${code ?? "null"}: ${stderr}`,
        ),
      );
    });
  });
}
