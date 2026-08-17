import { DomainError } from "./errors.ts";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type CallerId = string & { readonly __brand: "CallerId" };

export function parseCallerId(raw: string): CallerId {
  if (!UUID_RE.test(raw)) {
    throw new DomainError("caller.invalid_id", "Caller id must be a UUID.");
  }
  return raw.toLowerCase() as CallerId;
}
