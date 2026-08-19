import { InfraError } from "#shared";

const IDENT_RE = /^[a-z][a-z0-9_]*$/;

/** Identifiers are already constrained by the domain; this is the last gate. */
export function quote(name: string): string {
  if (!IDENT_RE.test(name)) {
    throw new InfraError(
      "sql.invalid_identifier",
      `Refusing to build SQL with '${name}' as an identifier.`,
    );
  }
  return `"${name}"`;
}

export function literal(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}
