import { DomainError } from "#domain";
import { InfraError } from "#shared";

export type Problem = { code: string; message: string };

/**
 * Why a read came back empty. A screen has to render against a half-up stack,
 * so an empty answer carries its reason: "nothing here yet" and "I could not
 * reach your database" are not the same page.
 */
export function problemFrom(error: unknown): Problem {
  if (error instanceof DomainError || error instanceof InfraError) {
    return { code: error.code, message: error.message };
  }
  return {
    code: "operator.unreachable",
    message: error instanceof Error ? error.message : "Unknown error.",
  };
}
