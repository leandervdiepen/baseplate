import { pgTable, text, uuid, doublePrecision, timestamp } from "drizzle-orm/pg-core";

/**
 * Every table carries owner_id. That is the column Baseplate matches against
 * the `sub` of a caller's token, and the column its trigger fills in on insert,
 * so the app never sets it and never sends it.
 */
const owner = () => uuid("owner_id").notNull();

export const boards = pgTable("boards", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: owner(),
  title: text("title").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const lists = pgTable("lists", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: owner(),
  boardId: uuid("board_id")
    .notNull()
    .references(() => boards.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  position: doublePrecision("position").notNull(),
});

export const cards = pgTable("cards", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: owner(),
  listId: uuid("list_id")
    .notNull()
    .references(() => lists.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  position: doublePrecision("position").notNull(),
});
