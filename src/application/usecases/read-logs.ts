import type { StackRuntime } from "../ports/stack-runtime.ts";
import type { StackStateStore } from "../ports/stack-state-store.ts";

export type ReadLogsDeps = {
  runtime: StackRuntime;
  store: StackStateStore;
};

const DEFAULT_TAIL = 80;

/**
 * A route cannot reach for Docker itself: a remote stack's logs are on the
 * server, and only the runtime knows how to get there.
 */
export class ReadLogs {
  constructor(private readonly deps: ReadLogsDeps) {}

  async execute(tail: number = DEFAULT_TAIL): Promise<string> {
    const record = await this.deps.store.load();
    return this.deps.runtime.logs(record?.server, { tail });
  }
}
