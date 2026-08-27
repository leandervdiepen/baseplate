import { applyEnvText } from "../../../src/delivery/operator-setup.ts";
import { stackEnvText } from "../../../src/delivery/operator-http/stack-env.ts";
import { composeEnv } from "#infrastructure";
import { afterEach, beforeEach, expect, test } from "vitest";

/**
 * A blank key means "the default" in both directions: Compose reads this
 * process's environment as well as the env file, and present-but-empty beats
 * `${VAR:-default}`. That is how password recovery stopped delivering mail.
 */

const KEYS = ["SMTP_HOST", "SMTP_PORT", "BACKUP_S3_BUCKET", "HCLOUD_TOKEN"];
let before: (string | undefined)[] = [];

beforeEach(() => {
  before = KEYS.map((key) => process.env[key]);
  for (const key of KEYS) {
    delete process.env[key];
  }
});

afterEach(() => {
  KEYS.forEach((key, index) => {
    const held = before[index];
    if (held === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = held;
    }
  });
});

test("a blank value in the config is not put in the environment at all", () => {
  applyEnvText("SMTP_HOST=\nSMTP_PORT=587\n", true);

  expect("SMTP_HOST" in process.env).toBe(false);
  expect(process.env.SMTP_PORT).toBe("587");
});

test("a blank value clears one the environment was holding, so the file wins", () => {
  process.env.SMTP_HOST = "smtp.example.com";

  applyEnvText("SMTP_HOST=\n", true);

  expect("SMTP_HOST" in process.env).toBe(false);
});

test("without override a blank value leaves the environment alone", () => {
  process.env.SMTP_HOST = "smtp.example.com";

  applyEnvText("SMTP_HOST=\n", false);

  expect(process.env.SMTP_HOST).toBe("smtp.example.com");
});

test("the stack env file leaves a blank key out for the same reason", () => {
  const text = stackEnvText({ SMTP_HOST: "", SMTP_PORT: "587" });

  expect(text).not.toContain("SMTP_HOST");
  expect(text).toContain("SMTP_PORT=587");
});

test("the operator's cloud credentials are not handed to docker compose", () => {
  const env = composeEnv(
    { HCLOUD_TOKEN: "secret", HETZNER_DNS_TOKEN: "secret", JWT_SECRET: "kept", PATH: "/usr/bin" },
    "/projects/mine",
  );

  expect("HCLOUD_TOKEN" in env).toBe(false);
  expect("HETZNER_DNS_TOKEN" in env).toBe(false);
  expect(env.PATH).toBe("/usr/bin");
  expect(env.BASEPLATE_PROJECT_ROOT).toBe("/projects/mine");
});
