import type { Server } from "#domain";

/**
 * A Baseplate stack up on this machine right now, this project's included.
 * One stack runs at a time, so this is how another one is recognised and named.
 */
export type RunningStack = {
  readonly projectName: string;
  /** The operator directory it was started from, read back from a label. */
  readonly projectRoot: string;
  /** Where its API answers, so an error can point at it. */
  readonly baseUrl: string;
};

export type DownOptions = {
  /** Remove the database volume too. This destroys the operator's data. */
  readonly volumes: boolean;
};

export type LogOptions = {
  /** How many lines from the end of each service. */
  readonly tail: number;
};

export type StackRuntime = {
  up(server: Server): Promise<void>;
  down(server: Server | undefined, options: DownOptions): Promise<void>;
  /** Applies pending migrations and re-applies row access against a running stack. */
  migrate(server: Server | undefined): Promise<void>;
  isHealthy(baseUrl: string): Promise<boolean>;
  runningStacks(): Promise<readonly RunningStack[]>;
  /** Stops one, keeping its data, so another project can have the ports. */
  stopProject(projectName: string): Promise<void>;
  /** Every service in one stream. Local answers over Docker, remote over SSH. */
  logs(server: Server | undefined, options: LogOptions): Promise<string>;
};
