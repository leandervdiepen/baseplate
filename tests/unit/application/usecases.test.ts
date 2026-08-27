import { createStack, DomainError } from "#domain";
import { MintToken, ProvisionStack, TeardownStack } from "#application";
import {
  MemoryClock,
  MemoryCloudProvider,
  MemoryStackRuntime,
  MemoryStackStateStore,
  MemoryTokenSigner,
} from "#infrastructure";
import { expect, test } from "vitest";

const stack = createStack({
  name: "baseplate",
  hostname: "localhost",
  callerRole: "app_user",
  databaseName: "app",
});

const subject = "11111111-1111-4111-8111-111111111111";

test("provision creates a server, applies the stack, and stores the URL", async () => {
  const cloud = new MemoryCloudProvider();
  const runtime = new MemoryStackRuntime();
  const store = new MemoryStackStateStore();
  const clock = new MemoryClock();
  const useCase = new ProvisionStack({
    cloud,
    runtime,
    store,
    clock,
    httpPort: 8080,
    projectName: "baseplate-app-1111",
  });

  const result = await useCase.execute(stack);

  expect(result.baseUrl).toBe("http://127.0.0.1:8080");
  expect(result.server.status).toBe("running");
  expect(cloud.firewallEnsured).toEqual([result.server.id]);
  expect(cloud.dnsEnsured).toEqual([`localhost:${result.server.id}`]);
  expect(runtime.upCalls).toBe(1);
  expect(store.record).toEqual(result);
});

test("provision fails when the stack never becomes healthy", async () => {
  const runtime = new MemoryStackRuntime();
  runtime.healthy = false;
  const useCase = new ProvisionStack({
    cloud: new MemoryCloudProvider(),
    runtime,
    store: new MemoryStackStateStore(),
    clock: new MemoryClock(),
    httpPort: 8080,
    projectName: "baseplate-app-1111",
  });

  await expect(useCase.execute(stack)).rejects.toMatchObject({
    code: "stack.unhealthy",
  });
});

test("teardown stops the runtime, destroys the server, and clears state", async () => {
  const cloud = new MemoryCloudProvider();
  const runtime = new MemoryStackRuntime();
  const store = new MemoryStackStateStore();
  const provision = new ProvisionStack({
    cloud,
    runtime,
    store,
    clock: new MemoryClock(),
    httpPort: 8080,
    projectName: "baseplate-app-1111",
  });
  const record = await provision.execute(stack);

  await new TeardownStack({ cloud, runtime, store }).execute({ destroy: true });

  expect(runtime.downCalls).toBe(1);
  expect(runtime.removedVolumes).toBe(true);
  expect(cloud.destroyed).toEqual([record.server.id]);
  expect(store.record).toBeUndefined();
});

test("down stops the stack but keeps the volumes and the server", async () => {
  const cloud = new MemoryCloudProvider();
  const runtime = new MemoryStackRuntime();
  const store = new MemoryStackStateStore();
  const record = await new ProvisionStack({
    cloud,
    runtime,
    store,
    clock: new MemoryClock(),
    httpPort: 8080,
    projectName: "baseplate-app-1111",
  }).execute(stack);

  await new TeardownStack({ cloud, runtime, store }).execute({ destroy: false });

  expect(runtime.removedVolumes).toBe(false);
  expect(cloud.destroyed).toEqual([]);
  expect(store.record).toEqual(record);
});

test("teardown still stops the runtime when nothing was provisioned", async () => {
  const runtime = new MemoryStackRuntime();
  await new TeardownStack({
    cloud: new MemoryCloudProvider(),
    runtime,
    store: new MemoryStackStateStore(),
  }).execute({ destroy: true });
  expect(runtime.downCalls).toBe(1);
});

test("provision refuses while another project's stack holds the ports", async () => {
  const runtime = new MemoryStackRuntime();
  runtime.running = [
    {
      projectName: "baseplate-kanban-6666",
      projectRoot: "/Users/dev/apps/kanban",
      baseUrl: "http://127.0.0.1:8080",
    },
  ];
  const useCase = new ProvisionStack({
    cloud: new MemoryCloudProvider(),
    runtime,
    store: new MemoryStackStateStore(),
    clock: new MemoryClock(),
    httpPort: 8080,
    projectName: "baseplate-app-1111",
  });

  await expect(useCase.execute(stack)).rejects.toMatchObject({
    code: "stack.another_running",
    message: /'kanban' is already running on http:\/\/127\.0\.0\.1:8080/,
  });
  expect(runtime.upCalls).toBe(0);
});

test("provision with replace stops the other project first", async () => {
  const runtime = new MemoryStackRuntime();
  runtime.running = [
    { projectName: "baseplate-kanban-6666", projectRoot: "/Users/dev/kanban", baseUrl: "" },
  ];
  const useCase = new ProvisionStack({
    cloud: new MemoryCloudProvider(),
    runtime,
    store: new MemoryStackStateStore(),
    clock: new MemoryClock(),
    httpPort: 8080,
    projectName: "baseplate-app-1111",
  });

  await useCase.execute(stack, { replace: true });

  expect(runtime.stopped).toEqual(["baseplate-kanban-6666"]);
  expect(runtime.upCalls).toBe(1);
});

test("this project's own stack already running is not another project", async () => {
  const runtime = new MemoryStackRuntime();
  runtime.running = [
    { projectName: "baseplate-app-1111", projectRoot: "/Users/dev/app", baseUrl: "" },
  ];
  const useCase = new ProvisionStack({
    cloud: new MemoryCloudProvider(),
    runtime,
    store: new MemoryStackStateStore(),
    clock: new MemoryClock(),
    httpPort: 8080,
    projectName: "baseplate-app-1111",
  });

  await useCase.execute(stack);

  expect(runtime.stopped).toEqual([]);
  expect(runtime.upCalls).toBe(1);
});

test("mint-token signs claims for a caller, with the project's own lifetime", async () => {
  const token = await new MintToken({
    signer: new MemoryTokenSigner(),
    callerRole: "app_user",
    defaultTtlSeconds: 3600,
  }).execute(subject);
  expect(token).toBe(`memory.${subject}.app_user.3600`);
});

test("mint-token takes a lifetime for this one token", async () => {
  const token = await new MintToken({
    signer: new MemoryTokenSigner(),
    callerRole: "app_user",
    defaultTtlSeconds: 3600,
  }).execute(subject, 43_200);
  expect(token).toBe(`memory.${subject}.app_user.43200`);
});

test("mint-token rejects a lifetime that is not a positive whole number", async () => {
  const mint = new MintToken({
    signer: new MemoryTokenSigner(),
    callerRole: "app_user",
    defaultTtlSeconds: 3600,
  });
  await expect(mint.execute(subject, 0)).rejects.toMatchObject({
    code: "token.invalid_lifetime",
  });
  await expect(mint.execute(subject, -60)).rejects.toMatchObject({
    code: "token.invalid_lifetime",
  });
  await expect(mint.execute(subject, 1.5)).rejects.toMatchObject({
    code: "token.invalid_lifetime",
  });
});

test("mint-token rejects a subject that is not a UUID", async () => {
  await expect(
    new MintToken({
      signer: new MemoryTokenSigner(),
      callerRole: "app_user",
      defaultTtlSeconds: 3600,
    }).execute("alice"),
  ).rejects.toBeInstanceOf(DomainError);
});

/**
 * The expensive failure: a server exists and the operator is paying for it, but
 * the state record teardown reads to find it was only written on success.
 */
test("a server that never becomes healthy is still one destroy can remove", async () => {
  const cloud = new MemoryCloudProvider();
  const runtime = new MemoryStackRuntime();
  runtime.healthy = false;
  const store = new MemoryStackStateStore();
  const provision = new ProvisionStack({
    cloud,
    runtime,
    store,
    clock: new MemoryClock(),
    httpPort: 8080,
    projectName: "baseplate-app-1111",
  });

  await expect(provision.execute(stack)).rejects.toMatchObject({ code: "stack.unhealthy" });

  // Read before teardown, which clears the record it just used.
  const id = store.record?.server.id;
  expect(id).toBeDefined();
  await new TeardownStack({ cloud, runtime, store }).execute({ destroy: true });
  expect(cloud.destroyed).toEqual([id]);
});

test("a stack that fails to start is still one destroy can remove", async () => {
  const cloud = new MemoryCloudProvider();
  const runtime = new MemoryStackRuntime();
  runtime.up = async () => {
    throw new Error("rsync exited 12");
  };
  const store = new MemoryStackStateStore();
  const provision = new ProvisionStack({
    cloud,
    runtime,
    store,
    clock: new MemoryClock(),
    httpPort: 8080,
    projectName: "baseplate-app-1111",
  });

  await expect(provision.execute(stack)).rejects.toThrow(/rsync/);

  const id = store.record?.server.id;
  expect(id).toBeDefined();
  await new TeardownStack({ cloud, runtime, store }).execute({ destroy: true });
  expect(cloud.destroyed).toEqual([id]);
});
