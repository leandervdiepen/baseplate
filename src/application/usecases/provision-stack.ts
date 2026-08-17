import { apiBaseUrl, DomainError, type Stack } from "#domain";
import type { Clock } from "../ports/clock.ts";
import type { CloudProvider } from "../ports/cloud-provider.ts";
import type { StackRuntime } from "../ports/stack-runtime.ts";
import type {
  ProvisionedStack,
  StackStateStore,
} from "../ports/stack-state-store.ts";

const HEALTH_TIMEOUT_MS = 60_000;
const HEALTH_INTERVAL_MS = 500;

export type ProvisionStackDeps = {
  cloud: CloudProvider;
  runtime: StackRuntime;
  store: StackStateStore;
  clock: Clock;
};

export class ProvisionStack {
  constructor(private readonly deps: ProvisionStackDeps) {}

  async execute(stack: Stack): Promise<ProvisionedStack> {
    const server = await this.deps.cloud.createServer(stack);
    await this.deps.cloud.ensureFirewall(server);
    await this.deps.cloud.ensureDns(stack, server);
    await this.deps.runtime.up(server);
    const baseUrl = apiBaseUrl(stack.hostname, server.ipv4);
    await this.waitUntilHealthy(baseUrl);
    const record = { server, baseUrl };
    await this.deps.store.save(record);
    return record;
  }

  private async waitUntilHealthy(baseUrl: string): Promise<void> {
    const deadline = this.deps.clock.now() + HEALTH_TIMEOUT_MS;
    while (this.deps.clock.now() < deadline) {
      if (await this.deps.runtime.isHealthy(baseUrl)) {
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
