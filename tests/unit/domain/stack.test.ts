import {
  apiBaseUrl,
  createStack,
  DomainError,
  parseCallerId,
  parseHostname,
} from "#domain";
import { expect, test } from "vitest";

const valid = {
  name: "baseplate",
  hostname: "localhost",
  callerRole: "app_user",
  databaseName: "app",
};

test("parses a caller UUID", () => {
  expect(parseCallerId("11111111-1111-4111-8111-111111111111")).toBe(
    "11111111-1111-4111-8111-111111111111",
  );
});

test("rejects a caller id that is not a UUID", () => {
  expect(() => parseCallerId("alice")).toThrow(DomainError);
});

test("accepts localhost and a domain as hostname", () => {
  expect(parseHostname("localhost")).toBe("localhost");
  expect(parseHostname("api.example.com")).toBe("api.example.com");
});

test("rejects a hostname that is neither localhost nor a domain", () => {
  expect(() => parseHostname("not a host")).toThrow(DomainError);
});

test("creates a stack from the values the operator controls", () => {
  const stack = createStack(valid);

  expect(stack.name).toBe("baseplate");
  expect(stack.hostname).toBe("localhost");
  expect(stack.callerRole).toBe("app_user");
  expect(stack.databaseName).toBe("app");
});

test("rejects a caller role that is not a lowercase identifier", () => {
  expect(() => createStack({ ...valid, callerRole: "App User" })).toThrow(DomainError);
});

test("rejects a stack name that is not kebab-case", () => {
  expect(() => createStack({ ...valid, name: "Baseplate Stack" })).toThrow(DomainError);
});

test("rejects a hostname that is not localhost or a domain", () => {
  expect(() => createStack({ ...valid, hostname: "not a host" })).toThrow(DomainError);
});

test("the local API URL follows the published port", () => {
  expect(apiBaseUrl(parseHostname("localhost"), "127.0.0.1", 9000)).toBe(
    "http://127.0.0.1:9000",
  );
});

test("a real hostname gets HTTPS and no port", () => {
  expect(apiBaseUrl(parseHostname("api.example.com"), "1.2.3.4", 8080)).toBe(
    "https://api.example.com",
  );
});
