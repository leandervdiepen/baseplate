import { apiBaseUrl, DomainError, type Server, type Stack } from "#domain";
import type { Clock } from "../ports/clock.ts";
import type { CloudProvider } from "../ports/cloud-provider.ts";
import type { RunningStack, StackRuntime } from "../ports/stack-runtime.ts";
import type {
  ProvisionedStack,
  StackStateStore,
} from "../ports/stack-state-store.ts";

const DEFAULT_HEALTH_TIMEOUT_MS = 180_000;
const HEALTH_INTERVAL_MS = 500;

export type ProvisionStackDeps = {
  cloud: CloudProvider;
  runtime: StackRuntime;
  store: StackStateStore;
  clock: Clock;
  /** The port Compose publishes locally. Ignored once a hostname has TLS. */
  httpPort: number;
  /** This project's compose project name, so another one can be told apart. */
  projectName: string;
  healthTimeoutMs?: number;
};

export type ProvisionOptions = {
  /** Stop whatever else is running first, instead of refusing. */
  readonly replace: boolean;
};

export class ProvisionStack {
  constructor(private readonly deps: ProvisionStackDeps) {}

  async execute(
    stack: Stack,
    options: ProvisionOptions = { replace: false },
  ): Promise<ProvisionedStack> {
    await this.clearTheWay(options.replace);
    const server = await this.deps.cloud.createServer(stack);
    await this.deps.cloud.ensureFirewall(server);
    await this.deps.cloud.ensureDns(stack, server);
    const record = {
      server,
      baseUrl: apiBaseUrl(stack.hostname, server.ipv4, this.deps.httpPort),
    };
    // Saved as soon as the server exists, because teardown reads this to find
    // it. Saving after the stack came up meant a failed build or a certificate
    // that took too long left a server the operator was paying for and nothing
    // in the product could remove.
    await this.deps.store.save(record);
    await this.deps.runtime.up(server);
    await this.waitUntilHealthy(record.baseUrl, server);
    return record;
  }

  /**
   * One stack at a time. Two of them want the same ports, and picking different
   * ones behind the operator's back only moves the surprise somewhere later.
   */
  private async clearTheWay(replace: boolean): Promise<void> {
    const others = (await this.deps.runtime.runningStacks()).filter(
      (running) => running.projectName !== this.deps.projectName,
    );
    const other = others[0];
    if (!other) {
      return;
    }
    if (!replace) {
      throw new DomainError("stack.another_running", describe(other, others.length));
    }
    for (const running of others) {
      await this.deps.runtime.stopProject(running.projectName);
    }
  }

  private async waitUntilHealthy(baseUrl: string, server: Server): Promise<void> {
    const timeoutMs = this.deps.healthTimeoutMs ?? DEFAULT_HEALTH_TIMEOUT_MS;
    const deadline = this.deps.clock.now() + timeoutMs;
    while (this.deps.clock.now() < deadline) {
      if (await this.deps.runtime.isHealthy(baseUrl, server)) {
        return;
      }
      await this.deps.clock.sleep(HEALTH_INTERVAL_MS);
    }
    throw new DomainError(
      "stack.unhealthy",
      `Stack at ${baseUrl} did not become healthy in time.`,
    );
  }
}

function describe(other: RunningStack, count: number): string {
  const segments = other.projectRoot.split(/[/\\]/).filter((part) => part.length > 0);
  const name = segments.at(-1) ?? other.projectName;
  const where = other.baseUrl ? ` on ${other.baseUrl}` : "";
  const rest = count > 1 ? ` (and ${count - 1} more)` : "";
  // A stack we cannot place still has to be refused. Saying so plainly beats
  // sending somebody to a directory named by an empty string.
  const how = other.projectRoot
    ? `Run \`baseplate down\` in ${other.projectRoot}, or \`baseplate up --replace\` to stop it and start this one.`
    : `It does not say where it came from. Run \`baseplate up --replace\` to stop it and start this one.`;
  return `'${name}' is already running${where}${rest}. ${how}`;
}
