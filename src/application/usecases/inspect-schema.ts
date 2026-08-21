import type { LiveTable, SchemaAdmin, SchemaHistoryEntry } from "../ports/schema-admin.ts";

export type InspectSchemaDeps = {
  admin: SchemaAdmin;
};

/** Enough to see the last few changes without asking for every one of them. */
const HISTORY_LIMIT = 20;

/**
 * Reading the schema. Changing it is `ChangeSchema`; these two exist so that
 * `SchemaAdmin` never has to leave this layer, which is what keeps every
 * surface asking the same thing rather than holding the port itself.
 */
export class InspectSchema {
  private readonly deps: InspectSchemaDeps;

  constructor(deps: InspectSchemaDeps) {
    this.deps = deps;
  }

  async tables(): Promise<readonly LiveTable[]> {
    return this.deps.admin.listTables();
  }

  async history(limit: number = HISTORY_LIMIT): Promise<readonly SchemaHistoryEntry[]> {
    return this.deps.admin.history(limit);
  }
}
