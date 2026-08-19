import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export const USAGE = `Usage: baseplate <command>

  init                     Start a project here: config, secrets, state
  up                       Bring the stack up and print the API URL
  down                     Stop the stack and destroy its volumes
  dashboard                Open the studio on 127.0.0.1

  tables                   List your tables and their columns
  types                    Print TypeScript types for your tables
  schema <change>          Change your tables; run \`baseplate schema\` for the list
  mint-token --sub UUID    Sign a caller JWT, for scripts and tests

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
