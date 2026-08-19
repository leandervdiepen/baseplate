import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./stack/schema.ts",
  out: "./stack/migrations",
});
