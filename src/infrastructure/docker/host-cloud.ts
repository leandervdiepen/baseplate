import { createServer, type Server, type Stack } from "#domain";
import type { CloudProvider } from "#application";

export class DockerHostCloudProvider implements CloudProvider {
  async createServer(_stack: Stack): Promise<Server> {
    return createServer("local", "127.0.0.1", "running");
  }

  async ensureFirewall(_server: Server): Promise<void> {}

  async ensureDns(_stack: Stack, _server: Server): Promise<void> {}

  async destroyServer(_serverId: string): Promise<void> {}
}
