import postgres from "postgres";
import type {
  LiveColumn,
  LiveTable,
  SchemaAdmin,
  SchemaHistoryEntry,
} from "#application";
import { changeSlug, type SchemaChange, type Table } from "#domain";
import { InfraError } from "#shared";
import { policyStatements, renderChange } from "./render-change.ts";
import { registryStatements } from "./registry.ts";

export type PostgresAdminConfig = {
  host: string;
  port: number;
  database: string;
  password: string;
};

export class PostgresSchemaAdmin implements SchemaAdmin {
  private readonly sql: postgres.Sql;

  constructor(config: PostgresAdminConfig) {
    this.sql = postgres({
      host: config.host,
      port: config.port,
      database: config.database,
      username: "postgres",
      password: config.password,
      max: 1,
      idle_timeout: 5,
      connect_timeout: 10,
      onnotice: () => undefined,
    });
  }

  async listTables(): Promise<LiveTable[]> {
    const rows = await this.sql<
      {
        name: string;
        owner_column: string;
        column_name: string;
        data_type: string;
        is_nullable: string;
        is_primary: boolean;
        references_table: string | null;
        references_column: string | null;
      }[]
    >`
      SELECT t.name,
             t.owner_column,
             c.column_name,
             c.data_type,
             c.is_nullable,
             COALESCE(k.is_primary, false) AS is_primary,
             f.foreign_table AS references_table,
             f.foreign_column AS references_column
      FROM baseplate.tables t
      JOIN information_schema.columns c
        ON c.table_schema = 'public' AND c.table_name = t.name
      LEFT JOIN (
        SELECT kcu.table_name, kcu.column_name, true AS is_primary
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON kcu.constraint_name = tc.constraint_name
         AND kcu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'PRIMARY KEY' AND tc.table_schema = 'public'
      ) k ON k.table_name = c.table_name AND k.column_name = c.column_name
      LEFT JOIN (
        SELECT kcu.table_name,
               kcu.column_name,
               ccu.table_name AS foreign_table,
               ccu.column_name AS foreign_column
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON kcu.constraint_name = tc.constraint_name
         AND kcu.table_schema = tc.table_schema
        JOIN information_schema.constraint_column_usage ccu
          ON ccu.constraint_name = tc.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
      ) f ON f.table_name = c.table_name AND f.column_name = c.column_name
      ORDER BY t.name, c.ordinal_position`;

    const byTable = new Map<string, LiveTable>();
    for (const row of rows) {
      const existing = byTable.get(row.name);
      const column: LiveColumn = {
        name: row.column_name,
        type: row.data_type,
        nullable: row.is_nullable === "YES",
        primaryKey: row.is_primary,
        ...(row.references_table && row.references_column
          ? { references: { table: row.references_table, column: row.references_column } }
          : {}),
      };
      if (existing) {
        byTable.set(row.name, {
          ...existing,
          columns: [...existing.columns, column],
        });
        continue;
      }
      byTable.set(row.name, {
        name: row.name,
        ownerColumn: row.owner_column,
        columns: [column],
      });
    }
    return [...byTable.values()];
  }

  async history(limit: number): Promise<SchemaHistoryEntry[]> {
    const rows = await this.sql<
      { id: string; change: string; statement: string; applied_at: Date }[]
    >`
      SELECT id, change, statement, applied_at
      FROM baseplate.schema_history
      ORDER BY id DESC
      LIMIT ${limit}`;
    return rows.map((row) => ({
      id: Number(row.id),
      change: row.change,
      statement: row.statement,
      appliedAt: row.applied_at.toISOString(),
    }));
  }

  /**
   * One transaction: the DDL, the registry row, the row access rules, and the
   * history entry. A failure anywhere leaves the database exactly as it was.
   */
  async apply(change: SchemaChange, declared: readonly Table[]): Promise<string> {
    const ddl = renderChange(change);
    const statements = [
      ddl,
      ...registryStatements(change),
      ...policyStatements(change, declared),
    ];
    try {
      await this.sql.begin(async (tx) => {
        for (const statement of statements) {
          await tx.unsafe(statement).simple();
        }
        await tx`INSERT INTO baseplate.schema_history (change, statement)
          VALUES (${changeSlug(change)}, ${ddl})`;
        await tx.unsafe("NOTIFY pgrst, 'reload schema'").simple();
      });
    } catch (cause) {
      throw new InfraError("schema.rejected", messageOf(cause), cause);
    }
    return ddl;
  }

  async close(): Promise<void> {
    await this.sql.end();
  }
}

function messageOf(cause: unknown): string {
  if (cause instanceof Error) {
    return cause.message;
  }
  return "The database refused the change.";
}
