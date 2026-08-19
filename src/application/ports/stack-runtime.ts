import type { Server } from "#domain";

export type StackRuntime = {
  up(server: Server): Promise<void>;
  down(server: Server | undefined): Promise<void>;
  /** Applies pending migrations and re-applies row access against a running stack. */
  migrate(server: Server | undefined): Promise<void>;
  isHealthy(baseUrl: string): Promise<boolean>;
};
