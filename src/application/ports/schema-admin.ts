import type { SchemaChange, Table } from "#domain";

export type LiveColumn = {
  readonly name: string;
  readonly type: string;
  readonly nullable: boolean;
  readonly primaryKey: boolean;
  /** The database supplies a value when the insert leaves it out. */
  readonly hasDefault: boolean;
  readonly references?: { readonly table: string; readonly column: string };
};

export type LiveTable = {
  readonly name: string;
  readonly ownerColumn: string;
  readonly columns: readonly LiveColumn[];
};

export type SchemaHistoryEntry = {
  readonly id: number;
  readonly change: string;
  readonly statement: string;
  readonly appliedAt: string;
};

/**
 * The database is where app tables live, so this is the only thing that can
 * answer what exists and the only thing that changes it. There is no repo file
 * to keep in step.
 */
export type SchemaAdmin = {
  listTables(): Promise<LiveTable[]>;
  history(limit: number): Promise<SchemaHistoryEntry[]>;
  /** Applies the DDL, updates the registry, and re-applies row access as one unit. */
  apply(change: SchemaChange, declared: readonly Table[]): Promise<string>;
  close(): Promise<void>;
};
