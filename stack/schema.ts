import { pgTable, text, uuid } from "drizzle-orm/pg-core";

/**
 * The app's tables, in drizzle syntax.
 * Change this file and run `npm run db:generate` to write a migration into
 * `stack/migrations/`. Baseplate's own tables live in `stack/platform/` and are
 * deliberately absent here.
 *
 * Every table needs an owner column, and its name must match the entry in
 * `stack/stack.json` so row access is applied to it.
 */
export const items = pgTable("items", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: uuid("owner_id").notNull(),
  body: text("body").notNull(),
});
