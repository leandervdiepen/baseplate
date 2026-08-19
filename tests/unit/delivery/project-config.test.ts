import { createServer } from "node:net";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { freePortFrom, initProject } from "../../../src/delivery/cli/init-command.ts";
import { parseEnvMap } from "../../../src/delivery/operator-http/env-file.ts";
import { stackEnvText } from "../../../src/delivery/operator-http/stack-env.ts";
import { composeProjectName } from "../../../src/delivery/project-name.ts";

function project(): string {
  return mkdtempSync(join(tmpdir(), "baseplate-project-"));
}

test("init writes a config with secrets generated for this project", async () => {
  const dir = project();

  await initProject(dir);

  const env = parseEnvMap(readFileSync(join(dir, "baseplate.env"), "utf8"));
  for (const key of [
    "JWT_SECRET",
    "POSTGRES_PASSWORD",
    "AUTHENTICATOR_PASSWORD",
    "AUTH_SERVICE_PASSWORD",
  ]) {
    expect(env[key]?.length, key).toBeGreaterThan(30);
  }
  expect(env.TARGET).toBe("local");
});

test("two projects never share a secret", async () => {
  const first = project();
  const second = project();

  await initProject(first);
  await initProject(second);

  const a = parseEnvMap(readFileSync(join(first, "baseplate.env"), "utf8"));
  const b = parseEnvMap(readFileSync(join(second, "baseplate.env"), "utf8"));
  expect(a.JWT_SECRET).not.toBe(b.JWT_SECRET);
  expect(a.POSTGRES_PASSWORD).not.toBe(b.POSTGRES_PASSWORD);
});

test("init keeps state out of the operator's git history", async () => {
  const dir = project();

  await initProject(dir);

  expect(existsSync(join(dir, ".baseplate/.gitignore"))).toBe(true);
});

test("init refuses to overwrite a project that is already here", async () => {
  const dir = project();
  await initProject(dir);

  await expect(initProject(dir)).rejects.toThrow(/already here/);
});

test("the stack never receives the operator's cloud credentials", () => {
  const text = stackEnvText({
    JWT_SECRET: "a-jwt-secret-that-is-long-enough-here",
    POSTGRES_PASSWORD: "pg",
    HCLOUD_TOKEN: "hetzner-cloud-token",
    HETZNER_DNS_TOKEN: "hetzner-dns-token",
    SSH_KEY_NAME: "laptop",
    ACCESS_TOKEN_TTL: "15m",
  });

  expect(text).toContain("JWT_SECRET=");
  expect(text).toContain("ACCESS_TOKEN_TTL=15m");
  expect(text).not.toContain("hetzner-cloud-token");
  expect(text).not.toContain("hetzner-dns-token");
  expect(text).not.toContain("laptop");
});

test("two projects never share Docker volumes, even with the same folder name", () => {
  const first = composeProjectName("/Users/someone/work/api");
  const second = composeProjectName("/Users/someone/side/api");

  expect(first).not.toBe(second);
  expect(first).toContain("api");
});

test("a compose project name survives an awkward directory name", () => {
  expect(composeProjectName("/tmp/My App (2)!")).toMatch(/^baseplate-my-app-2-[0-9a-f]{8}$/);
  expect(composeProjectName("/tmp/---")).toMatch(/^baseplate-project-[0-9a-f]{8}$/);
});

test("a port something is already listening on is skipped", async () => {
  const busy = createServer();
  const port = await new Promise<number>((done) => {
    busy.listen(0, () => {
      const address = busy.address();
      done(typeof address === "object" && address ? address.port : 0);
    });
  });
  try {
    expect(await freePortFrom(port)).toBeGreaterThan(port);
  } finally {
    busy.close();
  }
});

test("a free port is taken as it is", async () => {
  const probe = createServer();
  const port = await new Promise<number>((done) => {
    probe.listen(0, () => {
      const address = probe.address();
      done(typeof address === "object" && address ? address.port : 0);
    });
  });
  await new Promise<void>((done) => {
    probe.close(() => done());
  });

  expect(await freePortFrom(port)).toBe(port);
});
