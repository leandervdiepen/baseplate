import { DomainError } from "#domain";
import { InfraError } from "#shared";

export type Problem = { code: string; message: string };

/**
 * Why a read came back empty.
 *
 * Some screens must render whatever happens: a stack that is half up, or a
 * project whose target has no server yet, still gets a page. That is right, but
 * it used to be done by turning every failure into an empty list, so "nothing
 * here yet" and "I could not reach your database" looked identical - and the
 * second one is exactly what a remote target has to be able to say.
 *
 * So the empty answer carries its reason, and the studio shows it.
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
