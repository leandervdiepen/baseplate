import { SignJWT } from "jose";
import type { TokenSigner } from "#application";
import type { TokenClaims } from "#domain";
import { InfraError } from "#shared";

export class JwtTokenSigner implements TokenSigner {
  private readonly secret: Uint8Array;

  constructor(secret: string) {
    if (secret.length < 32) {
      throw new InfraError(
        "jwt.weak_secret",
        "JWT secret must be at least 32 characters.",
      );
    }
    this.secret = new TextEncoder().encode(secret);
  }

  async sign(claims: TokenClaims): Promise<string> {
    return new SignJWT({ role: claims.role })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(claims.subject)
      .sign(this.secret);
  }
}
