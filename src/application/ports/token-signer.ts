import type { TokenClaims } from "#domain";

export type TokenSigner = {
  sign(claims: TokenClaims): Promise<string>;
};
