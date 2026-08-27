import { createTable } from "#domain";
import type postgres from "postgres";
import { expect, test } from "vitest";
import { protectStatements } from "../../../src/infrastructure/postgres/render-change.ts";
import { syncPolicies } from "../../../stack/migrate/src/policies.ts";

/**
 * The studio writes a table's row access once, in the same transaction that
 * creates the table. The migrate service writes it again from its own copy of
 * the same SQL, on every start. Two copies is a thing that drifts, and drift
 * here means a table quietly changes who can read it at the next restart. Every
 * access mode is checked: a wider one drifting is the worse direction.
 */

const TABLES = [
  { table: "notes", ownerColumn: "owner_id", access: "private" as const },
  { table: "memos", ownerColumn: "author_id", access: "shared" as const },
  { table: "docs", ownerColumn: "owner_id", access: "public" as const },
];

/** Postgres does not care where a statement wraps, and neither does this. */
function squash(statement: string): string {
  return statement.replace(/\s+/g, " ").trim();
}

/**
 * The migrate service sends its policy statements rather than returning them,
 * so stand in for the connection and keep what it sent. Everything it sends as
 * a tagged template is a query about the database, not a policy.
 */
function recordingSql(): { sql: postgres.Sql; sent: string[] } {
  const sent: string[] = [];
  const query = () => Promise.resolve([]);
  const sql = Object.assign(query, {
    unsafe(text: string) {
      sent.push(text);
      return { simple: () => Promise.resolve([]) };
    },
  });
  return { sql: sql as unknown as postgres.Sql, sent };
}

test("the migrate service re-applies the same policy the studio wrote", async () => {
  const { sql, sent } = recordingSql();

  await syncPolicies(sql, TABLES, () => undefined);

  for (const { table, ownerColumn, access } of TABLES) {
    const studio = protectStatements(createTable(table, ownerColumn, access)).map(squash);
    const migrate = sent.filter((statement) => statement.includes(table)).map(squash);
    expect(studio.join(" ")).toContain("baseplate.caller_id()");
    expect(migrate, `policy for ${table}`).toEqual(studio);
  }
});
