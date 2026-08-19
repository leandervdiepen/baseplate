import { applySchemaChange, type SchemaChange, type Stack } from "#domain";
import type { MigrationWriter } from "../ports/migration-writer.ts";
import type { SchemaStore } from "../ports/schema-store.ts";
import type { StackRuntime } from "../ports/stack-runtime.ts";
import type { StackStateStore } from "../ports/stack-state-store.ts";

export type ChangeSchemaDeps = {
  schema: SchemaStore;
  migrations: MigrationWriter;
  runtime: StackRuntime;
  store: StackStateStore;
};

export type SchemaChangeResult = {
  readonly stack: Stack;
  readonly migration: string;
  readonly applied: boolean;
};

export class ChangeSchema {
  constructor(private readonly deps: ChangeSchemaDeps) {}

  /**
   * Writes the migration and the declaration together, then applies them.
   * A failed apply rolls both files back so the repo never claims a change
   * the database does not have.
   */
  async execute(change: SchemaChange): Promise<SchemaChangeResult> {
    const current = await this.deps.schema.read();
    const next = applySchemaChange(current, change);
    const migration = await this.deps.migrations.write(change);
    try {
      await this.deps.schema.write(next);
    } catch (error) {
      await this.deps.migrations.remove(migration.name);
      throw error;
    }

    const record = await this.deps.store.load();
    if (!record) {
      return { stack: next, migration: migration.name, applied: false };
    }
    try {
      await this.deps.runtime.migrate(record.server);
    } catch (error) {
      await this.deps.migrations.remove(migration.name);
      await this.deps.schema.write(current);
      throw error;
    }
    return { stack: next, migration: migration.name, applied: true };
  }
}
