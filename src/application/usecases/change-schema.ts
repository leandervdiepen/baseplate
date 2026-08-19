import {
  applySchemaChange,
  createTable,
  type SchemaChange,
  type Table,
} from "#domain";
import type { LiveTable, SchemaAdmin } from "../ports/schema-admin.ts";

export type ChangeSchemaDeps = {
  admin: SchemaAdmin;
};

export type SchemaChangeResult = {
  readonly statement: string;
  readonly tables: readonly LiveTable[];
};

/**
 * The operator's schema lives in their database, not in a file they commit.
 * This validates the change against what is there, then hands it to the
 * database to apply as one transaction.
 */
export class ChangeSchema {
  private readonly deps: ChangeSchemaDeps;

  constructor(deps: ChangeSchemaDeps) {
    this.deps = deps;
  }

  async execute(change: SchemaChange): Promise<SchemaChangeResult> {
    const current = await this.deps.admin.listTables();
    const next = applySchemaChange(declaredFrom(current), change);
    const statement = await this.deps.admin.apply(change, next);
    return { statement, tables: await this.deps.admin.listTables() };
  }
}

function declaredFrom(live: readonly LiveTable[]): Table[] {
  return live.map((table) => createTable(table.name, table.ownerColumn));
}
