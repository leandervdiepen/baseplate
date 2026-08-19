import { DomainError } from "#domain";
import type { StackRuntime } from "../ports/stack-runtime.ts";
import type { StackStateStore } from "../ports/stack-state-store.ts";

export type ApplyMigrationsDeps = {
  runtime: StackRuntime;
  store: StackStateStore;
};

/** Runs whatever is pending in `stack/migrations` against the running stack. */
export class ApplyMigrations {
  constructor(private readonly deps: ApplyMigrationsDeps) {}

  async execute(): Promise<void> {
    const record = await this.deps.store.load();
    if (!record) {
      throw new DomainError(
        "stack.not_provisioned",
        "Provision the stack before running migrations.",
      );
    }
    await this.deps.runtime.migrate(record.server);
  }
}
