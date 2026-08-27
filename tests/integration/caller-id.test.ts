import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "vitest";
import postgres from "postgres";

/**
 * A transaction-local setting reverts to the empty string, not to unset, and the
 * pooled connection goes to whoever asks next. So the case worth proving is the
 * second query on a connection that has already served a caller: it must answer
 * "nobody" rather than raise.
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
