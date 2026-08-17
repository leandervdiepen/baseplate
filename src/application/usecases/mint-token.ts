import { createTokenClaims, parseCallerId } from "#domain";
import type { TokenSigner } from "../ports/token-signer.ts";

export type MintTokenDeps = {
  signer: TokenSigner;
  callerRole: string;
};

export class MintToken {
  constructor(private readonly deps: MintTokenDeps) {}

  async execute(subject: string): Promise<string> {
    const claims = createTokenClaims(parseCallerId(subject), this.deps.callerRole);
    return this.deps.signer.sign(claims);
  }
}
