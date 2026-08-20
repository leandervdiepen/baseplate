import { upsertEnv, parseEnvMap } from "../../../src/delivery/operator-http/env-file.ts";
import { isLocalhostHost, isLoopbackAddress } from "../../../src/delivery/operator-http/localhost.ts";
import { expect, test } from "vitest";

test("upsertEnv replaces existing keys and keeps comments", () => {
  const next = upsertEnv("TARGET=local\n# keep\nJWT_SECRET=old\n", {
    JWT_SECRET: "new",
    HTTP_PORT: "8080",
  });
  expect(next).toContain("JWT_SECRET=new");
  expect(next).toContain("# keep");
  expect(next).toContain("HTTP_PORT=8080");
  expect(parseEnvMap(next).TARGET).toBe("local");
});

test("loopback addresses are accepted", () => {
  expect(isLoopbackAddress("127.0.0.1")).toBe(true);
  expect(isLoopbackAddress("::1")).toBe(true);
  // Two colons. This test used to assert the one-colon typo the code had.
  expect(isLoopbackAddress("::ffff:127.0.0.1")).toBe(true);
  expect(isLoopbackAddress("8.8.8.8")).toBe(false);
});

test("localhost Host headers are accepted", () => {
  expect(isLocalhostHost("127.0.0.1:8788")).toBe(true);
  expect(isLocalhostHost("localhost:8788")).toBe(true);
  expect(isLocalhostHost("example.com")).toBe(false);
});
