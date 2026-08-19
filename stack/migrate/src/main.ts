import { readFileSync } from "node:fs";
import postgres from "postgres";
import { applyMigrations } from "./apply.ts";
import { ensureLedger } from "./ledger.ts";
import { syncPolicies, type DeclaredPolicy } from "./policies.ts";
import { ensureRoles } from "./roles.ts";

const PLATFORM_DIR = process.env.PLATFORM_DIR ?? "/platform";
const MIGRATIONS_DIR = process.env.MIGRATIONS_DIR ?? "/migrations";
const STACK_FILE = process.env.STACK_FILE ?? "/stack/stack.json";

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

function declaredPolicies(): DeclaredPolicy[] {
  const stack = JSON.parse(readFileSync(STACK_FILE, "utf8")) as {
    accessPolicies?: DeclaredPolicy[];
  };
  return stack.accessPolicies ?? [];
}

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
    const count = await applyMigrations(
      sql,
      [
        { label: "platform", dir: PLATFORM_DIR },
        { label: "app", dir: MIGRATIONS_DIR },
      ],
      log,
    );
    log(count === 0 ? "no pending migrations" : `${count} migration(s) applied`);
    await syncPolicies(sql, declaredPolicies(), log);
    log("ready");
  } finally {
    await sql.end();
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`migrate failed: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
