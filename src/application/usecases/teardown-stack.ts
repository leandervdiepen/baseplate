import type { CloudProvider } from "../ports/cloud-provider.ts";
import type { StackRuntime } from "../ports/stack-runtime.ts";
import type { StackStateStore } from "../ports/stack-state-store.ts";

export type TeardownStackDeps = {
  cloud: CloudProvider;
  runtime: StackRuntime;
  store: StackStateStore;
};

export type TeardownOptions = {
  /**
   * Stopping and destroying are different things. Stopping keeps the database
   * and the server; destroying removes the volumes and the server with them.
   */
  readonly destroy: boolean;
};

export class TeardownStack {
  constructor(private readonly deps: TeardownStackDeps) {}

  async execute(options: TeardownOptions = { destroy: false }): Promise<void> {
    const record = await this.deps.store.load();
    await this.deps.runtime.down(record?.server, { volumes: options.destroy });
    if (!options.destroy) {
      return;
    }
    if (record) {
      await this.deps.cloud.destroyServer(record.server.id);
    }
    await this.deps.store.clear();
  }
}
