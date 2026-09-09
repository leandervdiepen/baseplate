import { afterEach, expect, test } from "vitest";
import { HetznerAccount } from "#infrastructure";

const realFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = realFetch;
});

function answerWith(replies: Record<string, { status?: number; body?: unknown; text?: string }>): void {
  globalThis.fetch = ((input: string | URL | Request) => {
    const url = String(input);
    const match = Object.keys(replies).find((key) => url.includes(key));
    const reply = match ? replies[match] : undefined;
    if (!reply) {
      return Promise.reject(new Error(`nothing stubbed for ${url}`));
    }
    const body = reply.text ?? JSON.stringify(reply.body ?? {});
    return Promise.resolve(new Response(body, { status: reply.status ?? 200 }));
  }) as typeof fetch;
}

test("a missing token is reported for cloud and DNS without a request", async () => {
  globalThis.fetch = (() => Promise.reject(new Error("should not be called"))) as typeof fetch;

  const snapshot = await new HetznerAccount({ token: "" }).inspect();

  expect(snapshot.cloud.ok).toBe(false);
  expect(snapshot.cloud.message).toContain("No Hetzner Cloud token");
  expect(snapshot.dns.message).toContain("No Hetzner Cloud token");
});

test("cloud resources stay visible when the token cannot read DNS zones", async () => {
  answerWith({
    "/locations": { body: { locations: [{ name: "nbg1", description: "Nuremberg" }] } },
    "/ssh_keys": { body: { ssh_keys: [{ name: "laptop" }] } },
    "/zones": { status: 401, body: {} },
  });

  const snapshot = await new HetznerAccount({ token: "good" }).inspect();

  expect(snapshot.cloud.ok).toBe(true);
  expect(snapshot.locations).toEqual([{ name: "nbg1", description: "Nuremberg" }]);
  expect(snapshot.sshKeys).toEqual([{ name: "laptop" }]);
  expect(snapshot.dns.ok).toBe(false);
  expect(snapshot.dns.message).toContain("rejected");
});

test("an invalid response reads as a rejected token, not as broken JSON", async () => {
  answerWith({
    "/locations": { body: { locations: [] } },
    "/ssh_keys": { body: { ssh_keys: [] } },
    "/zones": { text: "<!doctype html><html>sign in</html>" },
  });

  const snapshot = await new HetznerAccount({ token: "good" }).inspect();

  expect(snapshot.dns.ok).toBe(false);
  expect(snapshot.dns.message).toContain("rejected");
  expect(snapshot.dns.message).not.toContain("JSON");
});

test("an unreachable Hetzner says so rather than throwing", async () => {
  globalThis.fetch = (() => Promise.reject(new Error("getaddrinfo ENOTFOUND"))) as typeof fetch;

  const snapshot = await new HetznerAccount({ token: "a" }).inspect();

  expect(snapshot.cloud.ok).toBe(false);
  expect(snapshot.cloud.message).toContain("Could not reach Hetzner");
  expect(snapshot.zones).toEqual([]);
});
