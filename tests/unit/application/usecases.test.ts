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
  const useCase = new ProvisionStack({ cloud, runtime, store, clock, httpPort: 8080 });

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
  });
  const record = await provision.execute(stack);

  await new TeardownStack({ cloud, runtime, store }).execute();

  expect(runtime.downCalls).toBe(1);
  expect(cloud.destroyed).toEqual([record.server.id]);
  expect(store.record).toBeUndefined();
});

test("teardown still stops the runtime when nothing was provisioned", async () => {
  const runtime = new MemoryStackRuntime();
  await new TeardownStack({
    cloud: new MemoryCloudProvider(),
    runtime,
    store: new MemoryStackStateStore(),
  }).execute();
  expect(runtime.downCalls).toBe(1);
});

test("mint-token signs claims for a caller", async () => {
  const token = await new MintToken({
    signer: new MemoryTokenSigner(),
    callerRole: "app_user",
  }).execute(subject);
  expect(token).toBe(`memory.${subject}.app_user`);
});

test("mint-token rejects a subject that is not a UUID", async () => {
  await expect(
    new MintToken({
      signer: new MemoryTokenSigner(),
      callerRole: "app_user",
    }).execute("alice"),
  ).rejects.toBeInstanceOf(DomainError);
});
