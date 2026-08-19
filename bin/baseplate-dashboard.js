#!/usr/bin/env node
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const entry = resolve(here, "../src/delivery/operator-http/listen.ts");
const tsx = resolve(here, "../node_modules/tsx/dist/cli.mjs");

const child = spawn(process.execPath, [tsx, entry], {
  stdio: "inherit",
  env: { ...process.env, BASEPLATE_PROJECT: process.env.BASEPLATE_PROJECT ?? process.cwd() },
});
child.on("exit", (code) => process.exit(code ?? 1));
