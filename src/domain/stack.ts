import { createAccessPolicy, type AccessPolicy } from "./access-policy.ts";
import { createDatabase, type Database } from "./database.ts";
import { DomainError } from "./errors.ts";
import { isLocalHostname, parseHostname, type Hostname } from "./hostname.ts";

export type Stack = {
  readonly name: string;
  readonly hostname: Hostname;
  readonly callerRole: string;
  readonly database: Database;
  readonly accessPolicies: readonly AccessPolicy[];
};

export type StackInput = {
  name: string;
  hostname: string;
  callerRole: string;
  database: {
    name: string;
    tables: { name: string; ownerColumn: string }[];
  };
  accessPolicies: { table: string; ownerColumn: string }[];
};

export function createStack(input: StackInput): Stack {
  if (!/^[a-z][a-z0-9-]*$/.test(input.name)) {
    throw new DomainError(
      "stack.invalid_name",
      "Stack name must be a lowercase kebab-case identifier.",
    );
  }
  if (!/^[a-z][a-z0-9_]*$/.test(input.callerRole)) {
    throw new DomainError(
      "stack.invalid_caller_role",
      "Caller role must be a lowercase identifier.",
    );
  }
  const hostname = parseHostname(input.hostname);
  const database = createDatabase(input.database.name, input.database.tables);
  const accessPolicies = input.accessPolicies.map((policy) =>
    createAccessPolicy(policy.table, policy.ownerColumn),
  );
  assertPoliciesMatchTables(database, accessPolicies);
  return { name: input.name, hostname, callerRole: input.callerRole, database, accessPolicies };
}

export function apiBaseUrl(hostname: Hostname, ipv4: string): string {
  if (isLocalHostname(hostname)) {
    return `http://${ipv4}:8080`;
  }
  return `https://${hostname}`;
}

function assertPoliciesMatchTables(
  database: Database,
  policies: readonly AccessPolicy[],
): void {
  for (const policy of policies) {
    const table = database.tables.find((item) => item.name === policy.table);
    if (!table) {
      throw new DomainError(
        "policy.unknown_table",
        `Access policy refers to missing table '${policy.table}'.`,
      );
    }
    if (table.ownerColumn !== policy.ownerColumn) {
      throw new DomainError(
        "policy.owner_mismatch",
        `Access policy owner column must match table '${table.name}'.`,
      );
    }
  }
}
