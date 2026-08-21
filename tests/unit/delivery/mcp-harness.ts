import { createStack, DomainError } from "#domain";
import {
  ChangeSchema,
  InspectSchema,
  ManageBackups,
  ManageStorage,
  ManageUsers,
  MintToken,
  ProvisionStack,
  TeardownStack,
} from "#application";
import type { BackupAdmin, SchemaAdmin, StorageAdmin, UserAdmin } from "#application";
import {
  MemoryClock,
  MemoryCloudProvider,
  MemorySchemaAdmin,
  MemoryStackRuntime,
  MemoryStackStateStore,
  MemoryTokenSigner,
  MemoryUserAdmin,
} from "#infrastructure";
import { createMcpServer, type SessionOpener } from "../../../src/delivery/mcp/server.ts";
import type { ToolSession } from "../../../src/delivery/mcp/handle.ts";

const SUB = "11111111-1111-4111-8111-111111111111";

/**
 * The tools reach ports only through use cases now, so the harness composes an
 * operator the way the real composition root does: hand it adapters, not
 * use cases.
 */
export type TestPorts = {
  admin?: SchemaAdmin;
  storage?: StorageAdmin;
  backups?: BackupAdmin;
  users?: UserAdmin;
};

export function testSession(over: TestPorts = {}): ToolSession {
  const admin = over.admin ?? new MemorySchemaAdmin();
  const cloud = new MemoryCloudProvider();
  const runtime = new MemoryStackRuntime();
  const store = new MemoryStackStateStore();
  const clock = new MemoryClock();
  const stack = createStack({
    name: "baseplate",
    hostname: "localhost",
    callerRole: "app_user",
    databaseName: "app",
  });
  const provision = new ProvisionStack({ cloud, runtime, store, clock, httpPort: 8080, projectName: "test" });
  return {
    siteUrl: "http://localhost:3000",
    stack,
    operator: {
      changeSchema: new ChangeSchema({ admin }),
      schema: new InspectSchema({ admin }),
      mintToken: new MintToken({
        signer: new MemoryTokenSigner(),
        callerRole: "app_user",
        defaultTtlSeconds: 3600,
      }),
      provision,
      teardown: new TeardownStack({ cloud, runtime, store }),
      storage: new ManageStorage({ storage: over.storage ?? emptyStorage() }),
      backups: new ManageBackups({ backups: over.backups ?? emptyBackups() }),
      users: new ManageUsers({ users: over.users ?? new MemoryUserAdmin() }),
      close: async () => {},
    },
  };
}

export function open(session: ToolSession): SessionOpener {
  return (run) => run(session);
}

export function server(session: ToolSession = testSession()) {
  return createMcpServer("0.0.0-test", open(session));
}

export async function rpc(
  mcp: ReturnType<typeof createMcpServer>,
  method: string,
  params?: unknown,
  id: number = 1,
) {
  return mcp.accept(JSON.stringify({ jsonrpc: "2.0", id, method, ...(params === undefined ? {} : { params }) }));
}

export function toolText(response: unknown): { text: string; isError: boolean } {
  const body = response as {
    result?: { content?: { text: string }[]; isError?: boolean };
    error?: { message: string };
  };
  if (body.error) {
    throw new DomainError("test.rpc", body.error.message);
  }
  return { text: body.result?.content?.[0]?.text ?? "", isError: body.result?.isError === true };
}

function emptyStorage(): StorageAdmin {
  return {
    listBuckets: async () => [],
    createBucket: async () => {},
    setVisibility: async () => {},
    dropBucket: async () => 0,
    listObjects: async () => [],
    usage: async () => [],
    close: async () => {},
  };
}

function emptyBackups(): BackupAdmin {
  return {
    list: async () => [],
    drills: async () => [],
    request: async () => ({ ok: true, message: "ok" }),
    close: async () => {},
  };
}

export { SUB };
