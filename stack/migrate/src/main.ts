import postgres from "postgres";
import { applyMigrations } from "./apply.ts";
import { ensureLedger } from "./ledger.ts";
import { readDeclaredPolicies, syncPolicies } from "./policies.ts";
import { ensureRoles } from "./roles.ts";

const PLATFORM_DIR = process.env.PLATFORM_DIR ?? "/platform";

function log(line: string): void {
  process.stdout.write(`migrate: ${line}\n`);
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`migrate needs ${name}.`);
  }
  return value;
}

/**
 * Runs on every start. Platform migrations ship with the Baseplate version;
 * app tables are the operator's and live in the database, so all this does for
 * them is make row access match what `baseplate.tables` declares.
 */
async function main(): Promise<void> {
  const sql = postgres({
    host: process.env.POSTGRES_HOST ?? "postgres",
    database: process.env.POSTGRES_DB ?? "app",
    username: "postgres",
    password: required("POSTGRES_PASSWORD"),
    max: 1,
    onnotice: () => undefined,
  });
  try {
    await ensureRoles(sql, {
      authenticator: required("AUTHENTICATOR_PASSWORD"),
      authService: required("AUTH_SERVICE_PASSWORD"),
    });
    await ensureLedger(sql);
    const count = await applyMigrations(sql, [{ label: "platform", dir: PLATFORM_DIR }], log);
    log(count === 0 ? "platform up to date" : `${count} platform migration(s) applied`);
    await syncPolicies(sql, await readDeclaredPolicies(sql), log);
    log("ready");
  } finally {
    await sql.end();
  }
}

main().catch((error: unknown) => {
  process.stderr.write(
    `migrate failed: ${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exit(1);
});
