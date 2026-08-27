import type {
  ApiSchemaCache,
  Clock,
  CloudProvider,
  DownOptions,
  LiveTable,
  ProvisionedStack,
  RunningStack,
  SchemaAdmin,
  SchemaHistoryEntry,
  StackRuntime,
  StackStateStore,
  TokenSigner,
} from "#application";
import type { SchemaChange, Table, TokenClaims } from "#domain";
import { changeSlug, createServer, type Server, type Stack } from "#domain";

export { MemoryUserAdmin } from "./user-admin.ts";

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
  migrateCalls = 0;
  healthy = true;
  migrateError: Error | undefined;
  /** Volumes removed by the last `down`, so a test can prove data survived. */
  removedVolumes = false;
  running: RunningStack[] = [];
  readonly stopped: string[] = [];

  async up(_server: Server): Promise<void> {
    this.upCalls += 1;
  }

  async down(_server: Server | undefined, options: DownOptions): Promise<void> {
    this.downCalls += 1;
    this.removedVolumes = options.volumes;
  }

  async runningStacks(): Promise<readonly RunningStack[]> {
    return this.running;
  }

  async stopProject(projectName: string): Promise<void> {
    this.stopped.push(projectName);
    this.running = this.running.filter((stack) => stack.projectName !== projectName);
  }

  async migrate(_server: Server | undefined): Promise<void> {
    this.migrateCalls += 1;
    if (this.migrateError) {
      throw this.migrateError;
    }
  }

  async isHealthy(_baseUrl: string): Promise<boolean> {
    return this.healthy;
  }
}

export class MemorySchemaAdmin implements SchemaAdmin {
  tables: LiveTable[];
  readonly applied: string[] = [];
  applyError: Error | undefined;

  constructor(tables: LiveTable[] = []) {
    this.tables = tables;
  }

  async listTables(): Promise<LiveTable[]> {
    return this.tables;
  }

  async history(_limit: number): Promise<SchemaHistoryEntry[]> {
    return this.applied.map((change, index) => ({
      id: index + 1,
      change,
      statement: `-- ${change}`,
      appliedAt: "1970-01-01T00:00:00.000Z",
    }));
  }

  async apply(change: SchemaChange, declared: readonly Table[]): Promise<string> {
    if (this.applyError) {
      throw this.applyError;
    }
    this.applied.push(changeSlug(change));
    this.tables = declared.map((table) => ({
      name: table.name,
      ownerColumn: table.ownerColumn,
      columns: this.tables.find((live) => live.name === table.name)?.columns ?? [],
    }));
    return `-- ${changeSlug(change)}`;
  }

  async close(): Promise<void> {}
}

export class MemoryApiSchemaCache implements ApiSchemaCache {
  readonly waited: string[][] = [];

  async waitFor(tables: readonly string[]): Promise<void> {
    this.waited.push([...tables]);
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
    return `memory.${claims.subject}.${claims.role}.${claims.lifetimeSeconds}`;
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
