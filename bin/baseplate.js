#!/usr/bin/env node
// The CLI is TypeScript and stays that way: one source of truth, no build
// artefact that can drift from it. tsx is a dependency, not a dev dependency,
// for exactly this reason.
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { tsxCli } from "./tsx-entry.js";

const here = dirname(fileURLToPath(import.meta.url));
const entry = resolve(here, "../src/delivery/cli/main.ts");
const tsx = tsxCli();

const child = spawn(process.execPath, [tsx, entry, ...process.argv.slice(2)], {
  stdio: "inherit",
  env: { ...process.env, BASEPLATE_PROJECT: process.env.BASEPLATE_PROJECT ?? process.cwd() },
});
child.on("exit", (code) => process.exit(code ?? 1));
