import { createStack, DomainError } from "#domain";
import { ChangeSchema, MintToken, ProvisionStack, TeardownStack } from "#application";
import type { BackupAdmin, StorageAdmin } from "#application";
import {
  MemoryClock,
  MemoryCloudProvider,
  MemorySchemaAdmin,
  MemoryStackRuntime,
  MemoryStackStateStore,
  MemoryTokenSigner,
  MemoryUserAdmin,
} from "#infrastructure";
import type { Operator } from "#infrastructure";
import { createMcpServer, type SessionOpener } from "../../../src/delivery/mcp/server.ts";
import type { ToolSession } from "../../../src/delivery/mcp/handle.ts";

const SUB = "11111111-1111-4111-8111-111111111111";

export function testSession(over: Partial<Operator> = {}): ToolSession {
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
      admin,
      changeSchema: over.changeSchema ?? new ChangeSchema({ admin }),
      mintToken: over.mintToken ?? new MintToken({
        signer: new MemoryTokenSigner(),
        callerRole: "app_user",
        defaultTtlSeconds: 3600,
      }),
      provision: over.provision ?? provision,
      teardown: over.teardown ?? new TeardownStack({ cloud, runtime, store }),
      storage: over.storage ?? emptyStorage(),
      backups: over.backups ?? emptyBackups(),
      users: over.users ?? new MemoryUserAdmin(),
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
