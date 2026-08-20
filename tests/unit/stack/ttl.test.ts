import { expect, test } from "vitest";
import { formatTtl, parseTtl } from "../../../stack/shared/ttl.ts";

test("reads seconds, minutes, hours, and days", () => {
  expect(parseTtl("900", "1h")).toBe(900);
  expect(parseTtl("15m", "1h")).toBe(900);
  expect(parseTtl("12h", "1h")).toBe(43_200);
  expect(parseTtl("30d", "1h")).toBe(2_592_000);
});

test("falls back when the value is empty", () => {
  expect(parseTtl("", "15m")).toBe(900);
});

test("refuses a lifetime it cannot read", () => {
  expect(() => parseTtl("soon", "1h")).toThrow(/duration/);
  expect(() => parseTtl("0", "1h")).toThrow(/more than zero/);
  expect(() => parseTtl("-5m", "1h")).toThrow(/duration/);
});

test("formats back to the largest whole unit", () => {
  expect(formatTtl(2_592_000)).toBe("30d");
  expect(formatTtl(3600)).toBe("1h");
  expect(formatTtl(900)).toBe("15m");
  expect(formatTtl(45)).toBe("45s");
});
