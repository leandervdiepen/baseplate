import type { SchemaChange } from "#domain";

export type WrittenMigration = {
  readonly name: string;
  readonly sql: string;
};

/**
 * Turns a schema change into a migration file the stack will apply.
 * The SQL dialect belongs to the adapter, not to the use case.
 */
export type MigrationWriter = {
  write(change: SchemaChange): Promise<WrittenMigration>;
  remove(name: string): Promise<void>;
};
