import type { Server } from "#domain";

export type ProvisionedStack = {
  readonly server: Server;
  readonly baseUrl: string;
};

export type StackStateStore = {
  save(record: ProvisionedStack): Promise<void>;
  load(): Promise<ProvisionedStack | undefined>;
  clear(): Promise<void>;
};
