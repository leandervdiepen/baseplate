import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { expect, test } from "vitest";
import {
  checksum,
  readMigrations,
  splitStatements,
} from "../../../stack/migrate/src/files.ts";

test("splitStatements splits on the drizzle breakpoint", () => {
  const text = "CREATE TABLE a ();\n--> statement-breakpoint\nCREATE TABLE b ();";
  expect(splitStatements(text)).toEqual(["CREATE TABLE a ();", "CREATE TABLE b ();"]);
});

test("splitStatements keeps a file without breakpoints as one chunk", () => {
  expect(splitStatements("SELECT 1;\nSELECT 2;")).toEqual(["SELECT 1;\nSELECT 2;"]);
});

test("splitStatements drops comment-only chunks", () => {
  const text = "-- a note\n--> statement-breakpoint\nSELECT 1;";
  expect(splitStatements(text)).toEqual(["SELECT 1;"]);
});

test("checksum changes when a migration file is edited", () => {
  expect(checksum("SELECT 1;")).not.toBe(checksum("SELECT 2;"));
  expect(checksum("SELECT 1;")).toBe(checksum("SELECT 1;"));
});

test("readMigrations returns sql files in filename order and ignores the rest", () => {
  const dir = mkdtempSync(resolve(tmpdir(), "baseplate-migrations-"));
  writeFileSync(resolve(dir, "0002_second.sql"), "SELECT 2;");
  writeFileSync(resolve(dir, "0001_first.sql"), "SELECT 1;");
  writeFileSync(resolve(dir, "_journal.json"), "{}");
  expect(readMigrations(dir).map((file) => file.name)).toEqual([
    "0001_first.sql",
    "0002_second.sql",
  ]);
});
