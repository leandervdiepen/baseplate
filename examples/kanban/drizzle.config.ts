import { defineConfig } from "drizzle-kit";
import { readFileSync } from "node:fs";

/**
 * Drizzle talks to the database directly, so it reads the credentials from the
 * project config Baseplate generated rather than from a second copy of them.
 */
function env(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of readFileSync("baseplate.env", "utf8").split("\n")) {
    const eq = line.indexOf("=");
    if (line.trim().startsWith("#") || eq === -1) continue;
    out[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
  }
  return out;
}

const config = env();

export default defineConfig({
  schema: "./db/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    host: "127.0.0.1",
    port: Number(config.POSTGRES_PORT ?? 5432),
    user: "postgres",
    password: config.POSTGRES_PASSWORD ?? "",
    database: "app",
    ssl: false,
  },
});
