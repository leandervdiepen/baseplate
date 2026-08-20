import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "vitest";
import postgres from "postgres";

/**
 * `baseplate.caller_id()` reads a setting that services set per transaction.
 * When that transaction ends the setting does not go back to unset, it goes
 * back to the empty string, and the pooled connection is handed to whoever
 * asks next. So the case worth proving is the second query on a connection
 * that has already served a caller: it must answer "nobody", not raise.
 *
 * It used to raise, which broke the storage sweeper on every run and would
 * break any operator query sharing a pool with a caller's.
 */
const ROOT = resolve(import.meta.dirname, "../..");
const CALLER = "11111111-1111-4111-8111-111111111111";

function stackEnv(key: string): string {
  const line = readFileSync(resolve(ROOT, ".baseplate/stack.env"), "utf8")
    .split("\n")
    .find((entry) => entry.startsWith(`${key}=`));
  return line ? line.slice(key.length + 1) : "";
}

test("a connection that has served a caller still answers for the next query", async () => {
  const sql = postgres({
    host: "127.0.0.1",
    port: Number(stackEnv("POSTGRES_PORT") || "5432"),
    database: "app",
    username: "postgres",
    password: stackEnv("POSTGRES_PASSWORD"),
    max: 1,
  });

  try {
    const claimed = await sql.begin(async (tx) => {
      await tx`SELECT set_config('request.jwt.claims', ${JSON.stringify({ sub: CALLER })}, true)`;
      const rows = await tx<{ id: string | null }[]>`SELECT baseplate.caller_id() AS id`;
      return rows[0]?.id;
    });
    expect(claimed).toBe(CALLER);

    // Same connection, no caller this time.
    const after = await sql<{ id: string | null }[]>`SELECT baseplate.caller_id() AS id`;
    expect(after[0]?.id).toBeNull();
  } finally {
    await sql.end();
  }
}, 30_000);
