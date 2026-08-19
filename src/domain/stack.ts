import { DomainError } from "./errors.ts";
import { isLocalHostname, parseHostname, type Hostname } from "./hostname.ts";

/**
 * What the operator is running. Their tables are not here: those live in their
 * database and are read from it, so there is no file to keep in step.
 */
export type Stack = {
  readonly name: string;
  readonly hostname: Hostname;
  readonly callerRole: string;
  readonly databaseName: string;
};

export type StackInput = {
  name: string;
  hostname: string;
  callerRole: string;
  databaseName: string;
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
  if (!/^[a-z][a-z0-9_]*$/.test(input.databaseName)) {
    throw new DomainError(
      "database.invalid_name",
      "Database name must be a lowercase identifier.",
    );
  }
  return {
    name: input.name,
    hostname: parseHostname(input.hostname),
    callerRole: input.callerRole,
    databaseName: input.databaseName,
  };
}

export function apiBaseUrl(hostname: Hostname, ipv4: string, port: number): string {
  if (isLocalHostname(hostname)) {
    return `http://${ipv4}:${port}`;
  }
  return `https://${hostname}`;
}
