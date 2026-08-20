import { createTokenClaims, parseCallerId } from "#domain";
import type { TokenSigner } from "../ports/token-signer.ts";

export type MintTokenDeps = {
  signer: TokenSigner;
  callerRole: string;
  /** What the project's ACCESS_TOKEN_TTL says, so a minted token matches a signed-in one. */
  defaultTtlSeconds: number;
};

export class MintToken {
  constructor(private readonly deps: MintTokenDeps) {}

  async execute(subject: string, ttlSeconds?: number): Promise<string> {
    const claims = createTokenClaims(
      parseCallerId(subject),
      this.deps.callerRole,
      ttlSeconds ?? this.deps.defaultTtlSeconds,
    );
    return this.deps.signer.sign(claims);
  }
}
