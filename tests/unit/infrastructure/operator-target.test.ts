import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { expect, test } from "vitest";
import { createStack } from "#domain";
import { createOperator, tunnelArgs, type OperatorTarget } from "#infrastructure";

function config(target: OperatorTarget, statePath: string) {
  return {
    target,
    jwtSecret: "a-secret-long-enough-to-sign-with",
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
    hetznerDnsToken: "t",
    hetznerDnsZone: "example.com",
    sshKeyName: "key",
    serverLocation: "nbg1",
    accessTtlSeconds: 900,
  };
}

function emptyStatePath(): string {
  return resolve(mkdtempSync(resolve(tmpdir(), "baseplate-target-")), "state.json");
}

test("a local project talks to the database on this machine", async () => {
  const operator = await createOperator(config("local", emptyStatePath()));
  await operator.admin.close();
  await operator.storage.close();
  await operator.backups.close();
  await operator.users.close();
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
