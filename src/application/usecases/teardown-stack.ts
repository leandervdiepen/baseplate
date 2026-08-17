import type { CloudProvider } from "../ports/cloud-provider.ts";
import type { StackRuntime } from "../ports/stack-runtime.ts";
import type { StackStateStore } from "../ports/stack-state-store.ts";

export type TeardownStackDeps = {
  cloud: CloudProvider;
  runtime: StackRuntime;
  store: StackStateStore;
};

export class TeardownStack {
  constructor(private readonly deps: TeardownStackDeps) {}

  async execute(): Promise<void> {
    const record = await this.deps.store.load();
    await this.deps.runtime.down(record?.server);
    if (record) {
      await this.deps.cloud.destroyServer(record.server.id);
    }
    await this.deps.store.clear();
  }
}
