import { expect, test } from "vitest";
import { apiBaseFor } from "../../../src/delivery/operator-http/api-base.ts";

test("a local project is served over loopback on its own port", () => {
  expect(apiBaseFor({ TARGET: "local", HTTP_PORT: "8080" })).toBe("http://127.0.0.1:8080");
  expect(apiBaseFor({ TARGET: "local", HTTP_PORT: "9001" })).toBe("http://127.0.0.1:9001");
});

test("a project with no target set is local", () => {
  expect(apiBaseFor({})).toBe("http://127.0.0.1:8080");
});

test("a hetzner project is served over TLS at its hostname, never loopback", () => {
  const base = apiBaseFor({
    TARGET: "hetzner",
    BASEPLATE_HOSTNAME: "api.example.com",
    HTTP_PORT: "8080",
  });
  expect(base).toBe("https://api.example.com");
  expect(base).not.toContain("127.0.0.1");
});

test("a hetzner project with no hostname says so instead of reading the local stack", () => {
  expect(() => apiBaseFor({ TARGET: "hetzner" })).toThrow(/hostname/i);
  expect(() => apiBaseFor({ TARGET: "hetzner", BASEPLATE_HOSTNAME: "localhost" })).toThrow(
    /hostname/i,
  );
});
