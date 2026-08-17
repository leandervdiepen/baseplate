import { DomainError } from "./errors.ts";

export type Hostname = string & { readonly __brand: "Hostname" };

const DOMAIN_RE = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/;

export function parseHostname(raw: string): Hostname {
  const value = raw.trim().toLowerCase();
  if (value === "localhost") {
    return value as Hostname;
  }
  if (!DOMAIN_RE.test(value)) {
    throw new DomainError(
      "stack.invalid_hostname",
      "Hostname must be localhost or a domain.",
    );
  }
  return value as Hostname;
}

export function isLocalHostname(hostname: Hostname): boolean {
  return hostname === "localhost";
}
