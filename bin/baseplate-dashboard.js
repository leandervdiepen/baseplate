#!/usr/bin/env node
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { tsxCli } from "./tsx-entry.js";

const here = dirname(fileURLToPath(import.meta.url));
const entry = resolve(here, "../src/delivery/operator-http/listen.ts");
const tsx = tsxCli();

const child = spawn(process.execPath, [tsx, entry], {
  stdio: "inherit",
  env: { ...process.env, BASEPLATE_PROJECT: process.env.BASEPLATE_PROJECT ?? process.cwd() },
});
child.on("exit", (code) => process.exit(code ?? 1));
