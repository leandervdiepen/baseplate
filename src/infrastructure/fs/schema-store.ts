import { readFileSync, writeFileSync } from "node:fs";
import type { SchemaStore } from "#application";
import { createStack, type Stack, type StackInput } from "#domain";
import { InfraError } from "#shared";

export class FileSchemaStore implements SchemaStore {
  constructor(private readonly path: string) {}

  async read(): Promise<Stack> {
    try {
      return createStack(JSON.parse(readFileSync(this.path, "utf8")) as StackInput);
    } catch (cause) {
      if (cause instanceof Error && cause.name === "DomainError") {
        throw cause;
      }
      throw new InfraError("schema.unreadable", `Could not read ${this.path}.`, cause);
    }
  }

  async write(stack: Stack): Promise<void> {
    const input: StackInput = {
      name: stack.name,
      hostname: stack.hostname,
      callerRole: stack.callerRole,
      database: {
        name: stack.database.name,
        tables: stack.database.tables.map((table) => ({
          name: table.name,
          ownerColumn: table.ownerColumn,
        })),
      },
      accessPolicies: stack.accessPolicies.map((policy) => ({
        table: policy.table,
        ownerColumn: policy.ownerColumn,
      })),
    };
    writeFileSync(this.path, `${JSON.stringify(input, null, 2)}\n`, "utf8");
  }
}
