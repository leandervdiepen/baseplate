import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Commands that need a project and a reachable database. Beside the usage text
 * so the two cannot drift, and so the MCP catalogue can be held to the list.
 */
export const STACK_COMMANDS = [
  "up",
  "down",
  "destroy",
  "logs",
  "tables",
  "types",
  "schema",
  "storage",
  "backup",
  "restore",
  "users",
  "mint-token",
] as const;

export const USAGE = `Usage: baseplate <command>

  init [--port N]          Start a project here: config, secrets, state
                           Also --postgres-port N, --dashboard-port N,
                           and --mailpit-port N.
                           Defaults are 8080, 5432, 8788, and 8025.
  up [--replace]           Bring the stack up and print the API URL.
                           One stack runs at a time; --replace stops the other.
  down                     Stop the stack. Your data stays.
  destroy [--yes]          Delete the volumes, and any server. Cannot be undone.
  dashboard [--port N]     Open the studio on 127.0.0.1
  logs [--tail N]          What the stack has printed, every service at once
  mcp                      Operator tools over stdio, for agents

  tables                   List your tables and their columns
  types                    Print TypeScript types for your tables
  schema <change>          Change your tables; run \`baseplate schema\` for the list
  storage <command>        Buckets for files; run \`baseplate storage\` for the list
  backup <command>         Back up and drill; run \`baseplate backup\` for the list
  restore [<id>] [--yes]   Put a backup back over the live database
  users <command>          Accounts; run \`baseplate users\` for the list
  mint-token --sub UUID [--ttl 1h]
                           Sign a caller JWT, for scripts and tests

  --help, -h               Show this
  --version, -v            Show the Baseplate version

From nothing to an app:

  npx @diepen/baseplate init
  npx @diepen/baseplate up
  npx @diepen/baseplate schema add-table notes --column title:text
  npx @diepen/baseplate types > src/database.ts`;

/** The version an operator is running. It is the thing they pin. */
export function version(packageRoot: string): string {
  const raw = readFileSync(resolve(packageRoot, "package.json"), "utf8");
  return (JSON.parse(raw) as { version: string }).version;
}
