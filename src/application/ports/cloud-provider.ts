import type { Server, Stack } from "#domain";

export type CloudProvider = {
  createServer(stack: Stack): Promise<Server>;
  ensureFirewall(server: Server): Promise<void>;
  ensureDns(stack: Stack, server: Server): Promise<void>;
  destroyServer(serverId: string): Promise<void>;
};
