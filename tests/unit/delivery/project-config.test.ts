import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { initProject, portValue } from "../../../src/delivery/cli/init-command.ts";
import { parseEnvMap } from "../../../src/delivery/operator-http/env-file.ts";
import { stackEnvText } from "../../../src/delivery/operator-http/stack-env.ts";
import { composeProjectName } from "../../../src/delivery/project-name.ts";
import { dashboardPortFor, OPERATOR_HTTP_PORT } from "../../../src/delivery/operator-setup.ts";

function project(): string {
  return mkdtempSync(join(tmpdir(), "baseplate-project-"));
}

test("init writes a config with secrets generated for this project", () => {
  const dir = project();

  initProject(dir);

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

test("two projects never share a secret", () => {
  const first = project();
  const second = project();

  initProject(first);
  initProject(second);

  const a = parseEnvMap(readFileSync(join(first, "baseplate.env"), "utf8"));
  const b = parseEnvMap(readFileSync(join(second, "baseplate.env"), "utf8"));
  expect(a.JWT_SECRET).not.toBe(b.JWT_SECRET);
  expect(a.POSTGRES_PASSWORD).not.toBe(b.POSTGRES_PASSWORD);
});

test("init keeps state out of the operator's git history", () => {
  const dir = project();

  initProject(dir);

  expect(existsSync(join(dir, ".baseplate/.gitignore"))).toBe(true);
});

test("init refuses to overwrite a project that is already here", () => {
  const dir = project();
  initProject(dir);

  expect(() => initProject(dir)).toThrow(/already here/);
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



test("a project records its own studio port and reads it back", () => {
  const dir = project();

  initProject(dir);

  const written = parseEnvMap(readFileSync(join(dir, "baseplate.env"), "utf8")).DASHBOARD_PORT;
  expect(dashboardPortFor(dir)).toBe(Number(written));
});

test("a directory with no project still gets a studio port to offer first run on", () => {
  expect(dashboardPortFor(project())).toBe(OPERATOR_HTTP_PORT);
});

test("a config written before studio ports existed keeps working", () => {
  const dir = project();
  writeFileSync(join(dir, "baseplate.env"), "TARGET=local\nHTTP_PORT=8080\n", "utf8");

  expect(dashboardPortFor(dir)).toBe(OPERATOR_HTTP_PORT);
});

test("ports the developer names are the ports they get", () => {
  const dir = project();

  initProject(dir, { http: 9100, postgres: 5599, dashboard: 9788 });

  const env = parseEnvMap(readFileSync(join(dir, "baseplate.env"), "utf8"));
  expect(env.HTTP_PORT).toBe("9100");
  expect(env.POSTGRES_PORT).toBe("5599");
  expect(env.DASHBOARD_PORT).toBe("9788");
  expect(dashboardPortFor(dir)).toBe(9788);
});


test("a port that is not a port is refused before anything is written", () => {
  expect(() => portValue("abc", "--port")).toThrow(/between 1 and 65535/);
  expect(() => portValue("99999", "--port")).toThrow(/between 1 and 65535/);
  expect(() => portValue("0", "--port")).toThrow(/between 1 and 65535/);
  expect(portValue(undefined, "--port")).toBeUndefined();
  expect(portValue("9100", "--port")).toBe(9100);
});
