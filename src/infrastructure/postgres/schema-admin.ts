import postgres from "postgres";
import type {
  LiveColumn,
  LiveTable,
  SchemaAdmin,
  SchemaHistoryEntry,
} from "#application";
import { assertTableAccess, changeSlug, type SchemaChange, type Table } from "#domain";
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
        access: string;
        column_name: string;
        data_type: string;
        is_nullable: string;
        has_default: boolean;
        is_primary: boolean;
        references_table: string | null;
        references_column: string | null;
      }[]
    >`
      SELECT t.name,
             t.owner_column,
             t.access,
             c.column_name,
             c.data_type,
             c.is_nullable,
             (c.column_default IS NOT NULL) AS has_default,
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
        hasDefault: row.has_default,
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
        access: assertTableAccess(row.access),
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
    if (change.kind === "adopt-table") {
      await this.assertAdoptable(change.table, change.ownerColumn);
    }
    const ddl = renderChange(change);
    // Adopting a table and changing who may read it build nothing, so there is
    // no DDL to run. The rest of the transaction is the same: the registry row,
    // the access rules, the history entry.
    const record = ddl || note(change);
    const statements = [
      ...(ddl ? [ddl] : []),
      ...registryStatements(change),
      ...policyStatements(change, declared),
    ];
    try {
      await this.sql.begin(async (tx) => {
        for (const statement of statements) {
          await tx.unsafe(statement).simple();
        }
        await tx`INSERT INTO baseplate.schema_history (change, statement)
          VALUES (${changeSlug(change)}, ${record})`;
        await tx.unsafe("NOTIFY pgrst, 'reload schema'").simple();
      });
    } catch (cause) {
      if (cause instanceof InfraError) {
        throw cause;
      }
      throw new InfraError("schema.rejected", messageOf(cause), cause);
    }
    return record;
  }

  /**
   * A table made outside Baseplate is only adoptable if it is really there and
   * really has somewhere to put the owner. Checking here means the failure names
   * the problem instead of surfacing as a policy that will not compile.
   */
  private async assertAdoptable(table: string, ownerColumn: string): Promise<void> {
    const rows = await this.sql<{ column_name: string; data_type: string }[]>`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = ${table}`;
    if (rows.length === 0) {
      throw new InfraError(
        "schema.unknown_table",
        `There is no table called '${table}' in this database. Create it first, then adopt it.`,
      );
    }
    const owner = rows.find((row) => row.column_name === ownerColumn);
    if (!owner) {
      throw new InfraError(
        "schema.missing_owner_column",
        `Table '${table}' has no '${ownerColumn}' column, so there is no way to tell whose rows are whose. Add a uuid column called '${ownerColumn}', or name a different one with --owner-column.`,
      );
    }
    if (owner.data_type !== "uuid") {
      throw new InfraError(
        "schema.owner_column_type",
        `'${table}.${ownerColumn}' is ${owner.data_type}, and the owner column has to be uuid to match the sub of a token.`,
      );
    }
  }

  async close(): Promise<void> {
    await this.sql.end();
  }
}

/** What the history shows for a change that had no DDL of its own. */
function note(change: SchemaChange): string {
  if (change.kind === "adopt-table") {
    return `-- adopted ${change.table}, owned by ${change.ownerColumn}`;
  }
  if (change.kind === "set-access") {
    return `-- ${change.table} is now ${change.access}`;
  }
  return `-- ${changeSlug(change)}`;
}

function messageOf(cause: unknown): string {
  if (cause instanceof Error) {
    return cause.message;
  }
  return "The database refused the change.";
}
