import { execFile } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { promisify } from "node:util";
import { expect, test } from "vitest";
import { USAGE, version } from "../../../src/delivery/cli/usage.ts";

const run = promisify(execFile);
const BIN = resolve(import.meta.dirname, "../../../bin/baseplate.js");
const PACKAGE_ROOT = resolve(import.meta.dirname, "../../../");

/**
 * Run the real binary somewhere with no project in it. Reading the help was
 * once impossible there, because every command opened the project first.
 */
async function bare(args: string[]): Promise<{ stdout: string; code: number }> {
  const cwd = mkdtempSync(resolve(tmpdir(), "baseplate-cli-"));
  try {
    const { stdout } = await run(process.execPath, [BIN, ...args], {
      cwd,
      env: { ...process.env, BASEPLATE_PROJECT: cwd },
    });
    return { stdout, code: 0 };
  } catch (cause) {
    const error = cause as { stdout?: string; stderr?: string; code?: number };
    return { stdout: `${error.stdout ?? ""}${error.stderr ?? ""}`, code: error.code ?? 1 };
  }
}

test.for([["--help"], ["-h"], ["help"]])(
  "%s prints the usage without a project, and succeeds",
  async (args) => {
    const { stdout, code } = await bare(args);
    expect(code).toBe(0);
    expect(stdout).toContain("Usage: baseplate <command>");
  },
);

test.for([["--version"], ["-v"]])("%s prints the version an operator pinned", async (args) => {
  const { stdout, code } = await bare(args);
  expect(code).toBe(0);
  expect(stdout.trim()).toBe(version(PACKAGE_ROOT));
});

test("schema with no change lists the changes it takes", async () => {
  const { stdout, code } = await bare(["schema"]);
  expect(code).toBe(0);
  expect(stdout).toContain("add-table");
  expect(stdout).toContain("rename-table");
});

test("users with no subcommand lists what it takes", async () => {
  const { stdout, code } = await bare(["users"]);
  expect(code).toBe(0);
  expect(stdout).toContain("Usage: baseplate users <command>");
  expect(stdout).toContain("reset");
});

test("an unknown command names itself and exits non-zero", async () => {
  const { stdout, code } = await bare(["bogus"]);
  expect(code).toBe(1);
  expect(stdout).toContain("Unknown command 'bogus'");
});

test("no command at all is an error, not a silent success", async () => {
  expect((await bare([])).code).toBe(1);
});

test("the usage names every command it dispatches", () => {
  for (const command of [
    "init",
    "up",
    "down",
    "dashboard",
    "tables",
    "types",
    "schema",
    "storage",
    "backup",
    "restore",
    "users",
    "mint-token",
  ]) {
    expect(USAGE).toContain(command);
  }
});
