import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { expect, test } from "vitest";
import { createStack } from "#domain";
import { createOperator, tunnelArgs, type OperatorTarget } from "#infrastructure";

function config(
  target: OperatorTarget,
  statePath: string,
  jwtSecret = "a-secret-long-enough-to-sign-with",
  allowUnprovisioned = false,
) {
  return {
    target,
    jwtSecret,
    stack: createStack({
      name: "baseplate",
      hostname: target === "hetzner" ? "api.example.com" : "localhost",
      callerRole: "app_user",
      databaseName: "app",
    }),
    stackDir: "/nowhere/stack",
    projectName: "baseplate-test",
    projectRoot: "/nowhere/project",
    envFile: "/nowhere/project/.baseplate/stack.env",
    postgresPassword: "pw",
    postgresPort: 5432,
    statePath,
    httpPort: 8080,
    infraSourceDir: "/nowhere/infra",
    infraWorkDir: "/nowhere/project/.baseplate/infra",
    hcloudToken: "t",
    hetznerDnsZone: "example.com",
    sshKeyName: "key",
    serverLocation: "nbg1",
    accessTtlSeconds: 900,
    allowUnprovisioned,
  };
}

function emptyStatePath(): string {
  return resolve(mkdtempSync(resolve(tmpdir(), "baseplate-target-")), "state.json");
}

test("a local project talks to the database on this machine", async () => {
  const operator = await createOperator(config("local", emptyStatePath()));
  await operator.close();
});

/**
 * The bug this pins: every target got `host: 127.0.0.1`, so a project pointed
 * at Hetzner would happily read and write a local stack sitting on the same
 * port. The operator would be told they were managing their server.
 */
test("a hetzner project with no server refuses rather than reading the local one", async () => {
  await expect(createOperator(config("hetzner", emptyStatePath()))).rejects.toThrow(
    /no server yet/i,
  );
});

test("provisioning can build an operator before the first hetzner server exists", async () => {
  const operator = await createOperator(
    config("hetzner", emptyStatePath(), "a-secret-long-enough-to-sign-with", true),
  );
  await operator.close();
});

test("a hetzner project reaches the database through the ssh access it already has", () => {
  const statePath = emptyStatePath();
  writeFileSync(
    statePath,
    JSON.stringify({
      server: { id: "1", ipv4: "203.0.113.10", status: "running" },
      baseUrl: "https://api.example.com",
    }),
  );
  const args = tunnelArgs(
    { host: "203.0.113.10", user: "root", remoteHost: "127.0.0.1", remotePort: 5432 },
    54_321,
  );
  expect(args).toContain("-N");
  expect(args).toContain("127.0.0.1:54321:127.0.0.1:5432");
  expect(args).toContain("root@203.0.113.10");
  // Without this ssh stays up with no forward, and every query hangs instead
  // of failing.
  expect(args.join(" ")).toContain("ExitOnForwardFailure=yes");
});

/**
 * Config the operator tool can check on its own costs nothing to check. Doing it
 * after a tunnel means waiting on a network round trip to be told a secret is
 * the wrong length, or never being told, because the server's own complaint
 * arrives first.
 */
test("a secret that is too short is refused before anything is dialled", async () => {
  await expect(
    createOperator(config("hetzner", emptyStatePath(), "too-short")),
  ).rejects.toThrow(/at least 32 characters/i);
});
