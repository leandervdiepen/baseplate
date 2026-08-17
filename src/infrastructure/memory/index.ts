import type {
  Clock,
  CloudProvider,
  ProvisionedStack,
  StackRuntime,
  StackStateStore,
  TokenSigner,
} from "#application";
import type { TokenClaims } from "#domain";
import { createServer, type Server, type Stack } from "#domain";

export class MemoryCloudProvider implements CloudProvider {
  readonly servers = new Map<string, Server>();
  firewallEnsured: string[] = [];
  dnsEnsured: string[] = [];
  destroyed: string[] = [];

  async createServer(_stack: Stack): Promise<Server> {
    const server = createServer(crypto.randomUUID(), "127.0.0.1", "running");
    this.servers.set(server.id, server);
    return server;
  }

  async ensureFirewall(server: Server): Promise<void> {
    this.firewallEnsured.push(server.id);
  }

  async ensureDns(stack: Stack, server: Server): Promise<void> {
    this.dnsEnsured.push(`${stack.hostname}:${server.id}`);
  }

  async destroyServer(serverId: string): Promise<void> {
    this.destroyed.push(serverId);
    this.servers.delete(serverId);
  }
}

export class MemoryStackRuntime implements StackRuntime {
  upCalls = 0;
  downCalls = 0;
  healthy = true;

  async up(_server: Server): Promise<void> {
    this.upCalls += 1;
  }

  async down(_server: Server | undefined): Promise<void> {
    this.downCalls += 1;
  }

  async isHealthy(_baseUrl: string): Promise<boolean> {
    return this.healthy;
  }
}

export class MemoryStackStateStore implements StackStateStore {
  record: ProvisionedStack | undefined;

  async save(record: ProvisionedStack): Promise<void> {
    this.record = record;
  }

  async load(): Promise<ProvisionedStack | undefined> {
    return this.record;
  }

  async clear(): Promise<void> {
    this.record = undefined;
  }
}

export class MemoryTokenSigner implements TokenSigner {
  async sign(claims: TokenClaims): Promise<string> {
    return `memory.${claims.subject}.${claims.role}`;
  }
}

export class MemoryClock implements Clock {
  nowMs = 0;

  now(): number {
    return this.nowMs;
  }

  async sleep(ms: number): Promise<void> {
    this.nowMs += ms;
  }
}
